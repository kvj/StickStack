class DBProvider
	constructor: (@name, @version = '1')->

	open: (clean = true, handler) ->
		handler 'open: Not implemented'

	verify: (schema, handler) ->
		handler 'Not implemented'

	query: (line, params, handler) ->
		handler 'Not implemented'

	get: (name, def) ->
		null

	set: (name, value) ->
		null

class AirDBProvider extends DBProvider

	open: (clean = true, handler, absolute) ->
		@db = new air.SQLConnection()
		err = (event) =>
			log 'open error', event
			handler event.error.message
		@db.addEventListener air.SQLEvent.OPEN, (event) =>
			@db.removeEventListener air.SQLErrorEvent.ERROR, err
			handler null
		@db.addEventListener air.SQLErrorEvent.ERROR, err
		if absolute
			folder = air.File.applicationDirectory
		else
			folder = air.File.applicationStorageDirectory
		@dbFile = folder.resolvePath @name
		@db.openAsync @dbFile, 'create', null, false, 1024

	verify: (schema, handler) ->
		err = () =>
			log 'verify error', event
			do_reset_schema()
		do_reset_schema = () =>
			@db.removeEventListener air.SQLErrorEvent.ERROR, err
			@db.addEventListener 'close', (event) =>
				@dbFile.deleteFile()
				@open false, (err) =>
					if err then return handler err
					sqlsDone = 0
					for sql in schema
						createStmt = new air.SQLStatement()
						createStmt.sqlConnection = @db
						createStmt.addEventListener air.SQLEvent.RESULT, () =>
							if ++sqlsDone >= schema.length
								handler null
						createStmt.addEventListener air.SQLErrorEvent.ERROR, (event) =>
							handler event.error.message
						createStmt.text = sql
						createStmt.execute()
			@db.close()
		@db.addEventListener air.SQLEvent.SCHEMA, (event) =>
			tables = @db.getSchemaResult().tables
			log 'Schema', tables, schema, @clean
			if tables?.length isnt schema.length
				@clean = true
			log 'Need clean', @clean
			if @clean
				do_reset_schema()
			else
				handler null
		@db.addEventListener air.SQLErrorEvent.ERROR, err
		@db.loadSchema air.SQLTableSchema

	query: (line, params, handler) ->
		stmt = new air.SQLStatement()
		stmt.sqlConnection = @db
		stmt.addEventListener air.SQLEvent.RESULT, (event) =>
			result = stmt.getResult()
			data = []
			if not result or not result.data
				return handler null, data
			numResults = result.data.length
			for i in [0...numResults]
				row = result.data[i]
				data.push row
			handler null, data
		stmt.addEventListener air.SQLErrorEvent.ERROR, (event) =>
			handler event.error.message
		stmt.text = line
		for i in [0...params.length]
			stmt.parameters[i] = params[i]
		stmt.execute()

	get: (name, def) ->
		null

	set: (name, value) ->
		null

class HTML5Provider extends DBProvider
	open: (clean, handler) ->
		return handler 'HTML5 DB not supported' unless window and window.openDatabase
		log 'Ready to open'
		try
			@db = window.openDatabase env.prefix+@name, '', env.prefix+@name, 1024 * 1024 * 10
			log 'Opened', @db.version, @version
			@version_match = @db.version is @version
			@clean = clean
			handler null
		catch error
			handler error.message

	_query: (query, params, transaction, handler) ->
		# log 'SQL:', query, params
		transaction.executeSql query, params, (transaction, result) =>
			# log 'Query result:', result, query
			data = []
			for i in [0...result.rows.length]
				obj = {}
				for own key, value of result.rows.item i
					obj[key] = value if value
				data.push obj
			handler null, data, transaction
		, (transaction, error) =>
			log 'Error SQL', error
			handler error.message

	query: (query, params, handler, transaction) ->
		return handler "DB isn't opened" unless @db
		if transaction
			@_query query, params, transaction, handler
		else
			@db.transaction (transaction) =>
				# log 'Ready to query', transaction
				@_query query, params, transaction, handler
			, (error) =>
				log 'Error transaction', error
				handler error.message

	verify: (schema, handler) ->
		# log 'verify', schema
		@query 'select name, type from sqlite_master where type=? or type=?', ['table', 'index'], (err, res, tr) =>
			log	'SQL result', err, res, tr
			if err
				return handler err
			if not @version_match or @clean
				# drop tables/etc
				create_at = (index) =>
					if index < schema.length
						@query schema[index], [], (err) =>
							if err
								return handler err
							create_at index+1
						, tr
					else
						log 'Changing version ', @db.version, '=>', @version, typeof(@db.version)
						if not @version_match
							@db.changeVersion @db.version or '', @version, (tr) =>
								log 'Transaction'
								handler null, true
							, (err) =>
								log 'Version change error', err
								handler err
							, () =>
								log 'Changed version'
								handler null, true
						else
							handler null, false
				drop_at = (index) =>
					if index < res.length
						if res[index].name.substr(0, 2) is '__' or res[index].name.substr(0, 7) is 'sqlite_'
							return drop_at index+1
						@query 'drop '+res[index].type+' '+res[index].name, [], (err) =>
							if err
								return handler err
							drop_at index+1
						, tr
					else
						# drop complete
						create_at 0
				drop_at 0
			else
				handler null, false

	get: (name, def) ->
		return window?.localStorage[env.prefix+name] ? def

	set: (name, value) ->
		window?.localStorage[env.prefix+name] = value

class StorageProvider

	last_id: 0
	db_schema: ['create table if not exists updates (id integer primary key, version_in integer, version_out integer, version text)', 'create table if not exists data (id integer primary key, status integer default 0, updated integer default 0, own integer default 1, stream text, data text, i0 integer, i1 integer, i2 integer, i3 integer, i4 integer, i5 integer, i6 integer, i7 integer, i8 integer, i9 integer, t0 text, t1 text, t2 text, t3 text, t4 text, t5 text, t6 text, t7 text, t8 text, t9 text)', 'create table if not exists schema (id integer primary key, token text, schema text)']

	constructor: (@db) ->

	open: (handler) ->
		@db.open false, (err) =>
			log 'StorageProvider::Open result:', err
			if not err
				@db.verify @db_schema, (err, reset) =>
					log 'StorageProvider::Verify result', err, reset
					if err then return handler err
					@db.query 'select schema, token from schema', [], (err, data) =>
						log 'Schema', err, data
						if err then return handler err
						if data.length>0
							@schema = JSON.parse data[0].schema
							@token = data[0].token
						handler null
	
	_precheck: (stream, handler) ->
		if not @schema 
			handler 'Not synchronized'
			return false
		if not @schema[stream] 
			handler 'Unsupported stream'
			return false
		return true

	set_token: (token, handler) ->
		@token = token
		@db.query 'update schema set token=?', [token], (err) =>
			if handler then handler err
	
	sync: (app, oauth, handler) ->
		log 'Starting sync...', app
		oauth.token = @token
		reset_schema = no
		clean_sync = no
		in_from = 0
		out_from = 0
		out_items = 0
		in_items = 0
		finish_sync = (err) =>
			if err then return handler err
			@db.query 'insert into updates (id, version_in, version_out) values (?, ?, ?)', [@_id(), in_from, out_from], () =>
				@db.query 'delete from data where status=?', [3], () =>
					handler err, {
						in: in_items
						out: out_items
					}
		receive_out = () =>
			url = "/rest/out?from=#{out_from}&"
			if not clean_sync
				url += "inc=yes&"
			oauth.rest app, url, null, (err, res) =>
				# log 'After out:', err, res
				if err then return finish_sync err
				arr = res.a
				if arr.length is 0
					out_from = res.u
					finish_sync null
				else
					for i, item of arr
						last = parseInt(i) is arr.length-1
						object = null
						out_from = item.u
						in_items++
						try
							object = JSON.parse(item.o)
						catch e
							log 'Error parsing object', e
						do (last) =>
							# log 'Saving', item
							@create item.s, object, (err) =>
								# log 'After create', err
								if last then receive_out null
							, {
								status: item.st
								updated: item.u
								own: 0
								internal: yes
							}
		send_in = () =>
			slots = @schema._slots ? 10
			@db.query 'select id, stream, data, updated, status from data where own=? and updated>? order by updated limit '+slots, [1, in_from], (err, data) =>
				if err then return finish_sync err
				result = []
				slots_used = 0
				for i, item of data
					slots_needed = @schema[item.stream]?.in ? 1
					if slots_needed+slots_used>slots then break
					slots_used += slots_needed
					result.push {
						s: item.stream
						st: item.status
						u: item.updated
						o: item.data
						i: item.id
					}
					in_from = item.updated
					out_items++ 
				if result.length is 0
					if reset_schema then do_reset_schema null else receive_out null
					return
				oauth.rest app, '/rest/in?', JSON.stringify({a: result}), (err, res) =>
					# log 'After in:', err, res
					if err then return finish_sync err
					send_in null
		do_reset_schema = () =>
			@db.clean = true
			@db.verify @db_schema, (err, reset) =>
				# log 'Verify result', err, reset
				if err then return finish_sync err
				out_from = 0
				@db.query 'insert into schema (id, token, schema) values (?, ?, ?)', [@_id(), @token, JSON.stringify @schema], (err) =>
					if err then return handler err
					receive_out null
		get_last_sync = () =>
			@db.query 'select * from updates order by id desc', [], (err, data) =>
				if err then return finish_sync err
				if data.length>0
					in_from = data[0].version_in or 0
					out_from = data[0].version_out or 0
					if not clean_sync and out_from>0 then clean_sync = no
				log 'Start sync with', in_from, out_from
				send_in null
		oauth.rest app, '/rest/schema?', null, (err, schema) =>
			# log 'After schema', err, schema
			if err then return finish_sync err
			if not @schema or @schema._rev isnt schema._rev
				@schema = schema
				reset_schema = yes
				clean_sync = yes
			get_last_sync null
		, {
			check: true
		}

	_id: (id) ->
		if not id
			id = new Date().getTime()
		while id<=@last_id
			id++
		@last_id = id
		return id

	on_change: (type, stream, id) ->

	create: (stream, object, handler, options) ->
		if not @_precheck stream, handler then return
		if not object.id
		  object.id = @_id()
		questions = '?, ?, ?, ?, ?, ?'
		fields = 'id, status, updated, own, stream, data'
		values = [object.id, options?.status ? 1, options?.updated ? object.id, options?.own ? 1, stream, JSON.stringify(object)]
		numbers = @schema[stream].numbers ? []
		texts = @schema[stream].texts ? []
		for i in [0...numbers.length]
			questions += ', ?'
			fields += ', i'+i
			values.push object[numbers[i]] ? null
		for i in [0...texts.length]
			questions += ', ?'
			fields += ', t'+i
			values.push object[texts[i]] ? null
		@db.query 'insert or replace into data ('+fields+') values ('+questions+')', values, (err) =>
			if err
				handler err
			else 
				if not options?.internal then @on_change 'create', stream, object.id
				handler null, object

	update: (stream, object, handler) ->
		if not @_precheck stream, handler then return
		if not object or not object.id
			return handler 'Invalid object ID'
		# prepare SQL
		fields = 'status=?, updated=?, own=?, data=?'
		values = [2, @_id(), 1, JSON.stringify(object)]
		numbers = @schema[stream].numbers ? []
		texts = @schema[stream].texts ? []
		for i in [0...numbers.length]
			fields += ', i'+i+'=?'
			values.push object[numbers[i]] ? null
		for i in [0...texts.length]
			fields += ', t'+i+'=?'
			values.push object[texts[i]] ? null
		values.push object.id
		values.push stream
		@db.query 'update data set '+fields+' where id=? and stream=?', values, (err) =>
			if not err
				@on_change 'update', stream, object.id
			handler err

	remove: (stream, object, handler) ->
		if not @_precheck stream, handler then return
		if not object or not object.id
			return handler 'Invalid object ID'
		@db.query 'update data set status=?, updated=?, own=? where  id=? and stream=?', [3, @_id(new Date().getTime()), 1, object.id, stream], (err) =>
			if not err
				@on_change 'remove', stream, object.id
			handler err

	select: (stream, query, handler, options) ->
		if not @_precheck stream, handler then return
		extract_fields = (stream) =>
			numbers = @schema[stream]?.numbers ? []
			fields = id: 'id'
			for own i, name of @schema[stream]?.texts ? []
				fields[name] = 't'+i
			for own i, name of @schema[stream]?.numbers ? []
				fields[name] = 'i'+i
			return fields
		fields = extract_fields stream
		values = [stream, 3]
		array_to_query = (fields, arr = [], op = 'and') =>
			result = []
			for i in [0...arr.length]
				name = arr[i]
				if name?.op
					if name.op is 'not'
						res = array_to_query fields, name.var ? []
						if res 
							result.push 'not ('+res+')'
					else
						res = array_to_query fields, name.var ? [], name.op
						if res
							result.push res
				else
					if fields[name]
						value = arr[i+1]
						if value?.op
							if value.op is 'in'
								f = extract_fields value.stream
								values.push value.stream
								values.push 3
								result.push(''+fields[name]+' in (select '+f[value.field]+' from data where stream=? and status<>? and '+array_to_query(f, value.query ? [])+')')
							else
								# custom op
								if value.var
									result.push fields[name]+value.op+'?'
									values.push value.var ? null
								else
									result.push fields[name]+value.op
						else
							#equal
							result.push fields[name]+'=?'
							values.push value ? null
					i++
			result.join " #{op} "
		where = array_to_query fields, query ? []
		order = []
		if options?.order
			arr = options?.order
			if not $.isArray(arr)
				arr = [arr]
			for ar in arr
				if fields[ar] then order.push fields[ar]
		order.push 'id'
		limit = ''
		if options?.limit
			limit = ' limit '+options?.limit
		@db.query 'select data from data where stream=? and status<>? '+(if where then 'and '+where else '')+' order by '+(order.join ',')+limit, values, (err, data) =>
			if err then return handler err
			result = []
			for item in data
				try
					result.push JSON.parse(item.data)
				catch err
			handler null, result		

class DataManager

	constructor: (@app, @oauth, @storage) ->
		@oauth.on_new_token = (token) =>
			@storage.set_token token
		
	sync_timeout: 30
	timeout_id: null

	open: (handler) ->
		@storage.open (err) =>
			log 'Open result', err 
			if err then return handler err
			@storage.on_change = () =>
				@schedule_sync null
			handler null

	unschedule_sync: () ->
		# log 'Terminating schedule', @timeout_id
		if @timeout_id
			clearTimeout @timeout_id
			@timeout_id = null

	schedule_sync: () ->
		@unschedule_sync null
		# log 'Scheduling sync', @sync_timeout
		@timeout_id = setTimeout () =>
			@on_scheduled_sync null
		, 1000*@sync_timeout

	on_scheduled_sync: () ->

	findOne: (stream, id, handler) ->
		@storage.select stream, ['id', id], (err, data) =>
			if err then return handler err
			if data.length is 0 then return handler 'Not found'
			handler null, data[0]

	_save: (stream, object, handler) ->
		if not object.id
			@storage.create stream, object, (err) =>
				if err then return handler err
				handler null, object
		else
			@storage.update stream, object, (err) =>
				if err then return handler err
				handler null, object

	get: (name, def) ->
		return @storage.db.get name, def

	set: (name, value) ->
		return @storage.db.set name, value

	sync: (handler) ->
		return @storage.sync @app, @oauth, (err, data) =>
			if not err and @timeout_id
				@unschedule_sync null
			handler err, data

window.HTML5Provider = HTML5Provider
window.AirDBProvider = AirDBProvider
window.StorageProvider = StorageProvider
window.Lima1DataManager = DataManager
window.env =
	mobile: no
	prefix: ''
