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

	is: (name, def) ->
		def ? no

	set: (name, value) ->
		null

class ChannelProvider

	type: 'none'

	constructor: (@oauth) ->

	is_connected: ->
		return no

	need_channel: ->
		return no

	on_channel: (channel) ->

	on_update: (message) ->
	on_connected: ->
	on_disconnected: ->

class DesktopChannelProvider extends ChannelProvider

	socket: null
	type: 'desktop'

	constructor: (@oauth) ->
		ui.remoteScriptLoader(@oauth.transport.uri+'/_ah/channel/jsapi', 'goog');
		# yepnope({
		# 	# load: ['https://talkgadget.google.com/talkgadget/channel.js']
		# 	# load: [@oauth.transport.uri+'/_ah/channel/jsapi'],
		# 	complete: () =>
		# 		log('Channel API loaded');
		# })

	is_connected: ->
		return @socket

	need_channel: ->
		log 'Need channel:', @socket, window._goog()
		if not @socket and window._goog() and window._goog().appengine
			return yes
		return no

	on_channel: (channel) ->
		if not @need_channel() then return
		goog = _goog();
		@socket = new goog.appengine.Channel channel
		@socket.open {
			onopen: () =>
				log 'Socket opened'
				@on_connected()
			onmessage: (message) =>
				log 'Message from socket:', message, message.data
				@on_update message
			onerror: (err) =>
				log 'Socket error:', err
				@socket = null
				@on_disconnected()
			onclose: =>
				log 'Socket closed'
				@socket = null
				@on_disconnected()
		}

class CacheProvider

	constructor: (@oauth, @app, @maxwidth) ->

	# Copies file to cache
	store: (name, path, handler) ->
		handler null

	# Returns file name by it's path
	path_to_name: (path) ->
		return path

	# Downloads? and Returns path to file in cache
	get: (name, handler) ->
		handler null

	# Uploads file from cache
	upload: (name, handler) ->
		handler null

	# Removes file from cache
	remove: (name, handler) ->
		handler null

class HTML5CacheProvider extends CacheProvider

	constructor: (@oauth, @app, @maxwidth) ->
		@fs = null
		window.webkitStorageInfo.requestQuota PERSISTENT, 100*1024*1024, (bytes) =>
			window.webkitRequestFileSystem window.PERSISTENT, bytes, (fs) =>
				@fs = fs
				fs.root.getDirectory 'cache', {create: true}, (dir) =>
					@cacheDir = dir
					log 'Filesystem ready', @fs, dir
				, (err) =>
					log 'Error getting dir', err
					@fs = null
			, (err) =>
				log 'Error requesting FS:', err
		, (err) =>
			log 'Error requesting quota:', err

	path_to_name: (path) ->
		log 'path_to_name', path
		return path.name

	# Copies file to cache
	store: (name, path, handler) ->
		# log 'Saving file', name, path
		if not @cacheDir then return handler 'No filesystem'
		openForRead = (file) =>
			reader = new FileReader()
			reader.onloadend = (e) =>
				# log 'Read done', e
				openForWrite name, reader.result
			reader.onerror = (err) =>
				log 'Error reading', err
				handler 'Read error'
			reader.readAsArrayBuffer file
		readWrite = (data, file) =>
			file.createWriter (writer) =>
				writer.onwriteend = () =>
					handler null, file.toURL()
				writer.onerror = (err) =>
					log 'Write failed', err
					handler 'Write error'
				bb = new WebKitBlobBuilder()
				bb.append data
				writer.write bb.getBlob()
			, (err) =>
				log 'Write failed', err
				handler 'Write error'
		openForWrite = (name, data) =>
			@cacheDir.getFile name, {create: true}, (file) =>
				readWrite data, file
			, (err) =>
					log 'Create file failed', err
					handler 'Write error'
		openForRead path

	# Downloads? and Returns path to file in cache
	get: (name, handler) ->
		if not @cacheDir then return handler 'No filesystem'
		downloadFile = (name) =>
			log 'File not found, downloading', name
			url = "/rest/file/download?name=#{name}&"
			if _.endsWith name, '.jpg'
				url += "width=#{@maxwidth}&"
			# log 'Download', url
			url = @oauth.getFullURL(@app, url)
			xhr = new XMLHttpRequest()
			xhr.open 'GET', url, yes
			xhr.responseType = 'blob'
			xhr.onload = (e) =>
				log 'Load', xhr.response, e
				if xhr.response
					# log 'Download OK', xhr, status
					@cacheDir.getFile name, {create: true}, (file) =>
						file.createWriter (writer) =>
							writer.onwriteend = () =>
								# log 'Write done, yea!'
								handler null, file.toURL()
							writer.onerror = (err) =>
								log 'Write failed', err
								handler 'Write error'
							writer.write xhr.response
						, (err) =>
							log 'Write failed', err
							handler 'Write error'
					, (err) =>
							log 'Create file failed', err
							handler 'Write error'
				else
					handler 'HTTP error'
			xhr.onerror = (e) =>
				log 'XHR error', e, arguments
			xhr.send()
		@cacheDir.getFile name, {create: false}, (file) =>
			log 'File found:', file, file.toURL()
			file.getMetadata (meta) =>
				if meta.size>0
					handler null, file.toURL()
				else
					downloadFile name
			, (err) =>
				log 'Error getting metadata', err
				handler 'File error'
		, (err) =>
			downloadFile name
	
	# Uploads file from cache
	upload: (name, handler) ->
		if not @cacheDir then return handler 'No filesystem'
		getFileContents = (name) =>
			@cacheDir.getFile name, {create: false}, (file) =>
				# log 'File found:', file
				file.file (file) =>
					doUpload file, "/rest/file/upload?name=#{name}&"
				, (err) =>
					log 'Error reading', err
					handler 'Read error'
			, (err) =>
				handler null, -2
		# getUploadURL = (file) =>
		# 	@oauth.rest @app, "/rest/file/upload?name=#{name}&", null, (err, data) => 
		# 		# log 'getUploadURL done', data
		# 		if err then return handler 'Error uploading file'
		# 		doUpload file, data.u
		doUpload = (data, url) =>
			xhr = new XMLHttpRequest()
			xhr.open 'POST', @oauth.getFullURL(@app, url), yes
			formData = new FormData()
			formData.append 'file', data
			xhr.onload = (e) =>
				log 'Upload done', e, xhr.status
				if xhr.status isnt 200
					handler 'HTTP error'
				else
					handler null, -1
			xhr.onerror = (e) =>
				log 'XHR error', e, arguments
				handler 'HTTP error'
			xhr.send formData
		getFileContents name

	# Removes file from cache
	remove: (name, handler) ->
		if not @cacheDir then return handler 'No filesystem'
		@cacheDir.getFile name, {create: false}, (file) =>
			log 'File found:', file, file.toURL()
			file.remove () =>
				handler null
			, (err) =>
				handler 'File error'
		, (err) =>
			handler null

class PhoneGapCacheProvider extends CacheProvider

	constructor: (@oauth, @app, @maxwidth) ->
	    PhoneGap.addConstructor () =>
	        PhoneGap.addPlugin 'Cache', this

	# Copies file to cache
	store: (name, path, handler) ->
		PhoneGap.exec () =>
			handler null
		, (err) =>
			handler err ? 'PhoneGap error'
		, 'Cache', 'copy', [name, path]

	# Downloads? and Returns path to file in cache
	get: (name, handler) ->
		PhoneGap.exec (url) =>
			handler null, url
		, (err) =>
			url = "/rest/file/download?name=#{name}&"
			if _.endsWith name, '.jpg'
				url += "width=#{@maxwidth}&"
			log 'Download', url
			PhoneGap.exec (url) =>
				handler null, url
			, (err) =>
				handler err ? 'PhoneGap error'
			, 'Cache', 'download', [name, @oauth.getFullURL(@app, url)]
		, 'Cache', 'get', [name]

	# Uploads file from cache
	upload: (name, handler) ->
		PhoneGap.exec () =>
			PhoneGap.exec () =>
				# Uploaded
				handler null, -1
			, (err) =>
				handler err ? 'PhoneGap error'
			, 'Cache', 'upload', [name, @oauth.getFullURL(@app, "/rest/file/upload?name=#{name}&")]
		, (err) =>
			# File not in cache - give a chance to skip
			handler null, -2
		, 'Cache', 'get', [name]

	# Removes file from cache
	remove: (name, handler) ->
		PhoneGap.exec () =>
			handler null
		, (err) =>
			handler err ? 'PhoneGap error'
		, 'Cache', 'remove', [name]

class AirCacheProvider extends CacheProvider

	_folder: () ->
		folder = air.File.applicationStorageDirectory.resolvePath 'cache'
		if not folder.exists
			folder.createDirectory()
		return folder

	path_to_name: (path) ->
		return path.nativePath

	# Copies file to cache
	store: (name, path, handler) ->
		file  = new air.File path.nativePath
		if not file.exists then return handler 'File not found'
		file.addEventListener 'complete', () =>
			handler null
		file.addEventListener 'ioError', () =>
			handler 'Error copying file'
		file.copyToAsync @_folder().resolvePath(name), yes

	# Downloads? and Returns path to file in cache
	get: (name, handler) ->
		file = @_folder().resolvePath name
		if file.exists
			return handler null, file.url
		
		loader = new air.URLLoader()
		url = "/rest/file/download?name=#{name}&"
		if _.endsWith name, '.jpg'
			url += "width=#{@maxwidth}&"
		log 'Download', url
		request = new air.URLRequest(@oauth.getFullURL(@app, url))
		loader.dataFormat = air.URLLoaderDataFormat.BINARY
		loader.addEventListener 'complete', (e) =>
			log 'File arrived'
			stream = new air.FileStream()
			try
			  stream.open file, air.FileMode.WRITE
			  stream.writeBytes loader.data
			  stream.close();
			  return handler null, file.url
			catch error
				handler 'Error writing data'
		loader.addEventListener 'ioError', () =>
			log 'File download error'
			handler 'Error downloading file'
		loader.load request

	# Uploads file from cache
	upload: (name, handler) ->
		file = @_folder().resolvePath name
		if not file.exists
			return handler null, -2
		@oauth.rest @app, "/rest/file/upload?name=#{name}&", null, (err, data) => 
			if err then return handler 'Error uploading file'
			log 'Uploading:', @oauth.transport.uri, data.u
			request = new air.URLRequest(data.u)
			request.method = air.URLRequestMethod.POST
			request.contentType = 'multipart/form-data'
			vars = new air.URLVariables()
			file.addEventListener 'ioError', (e) =>
				log 'Upload error', e
				handler 'Error uploading file'
			file.addEventListener 'uploadCompleteData', () =>
				log 'File uploaded'
				handler null, -1
			file.upload request, 'file', no

	# Removes file from cache
	remove: (name, handler) ->
		file = @_folder().resolvePath name
		try
			if file.exists
				file.deleteFile()
			handler null
		catch error
		  handler 'Error removing file'

class AirDBProvider extends DBProvider

	open: (clean = true, handler, absolute) ->
		@db = new air.SQLConnection()
		err = (event) =>
			log 'open error', event
			handler event.error.message
		@db.addEventListener air.SQLEvent.OPEN, (event) =>
			log 'Open in open'
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
		log 'Verify from here'
		err = () =>
			log 'verify error', event
			do_reset_schema()
		do_reset_schema = () =>
			log 'Reset called'
			@db.removeEventListener air.SQLErrorEvent.ERROR, err
			afterClose = () =>
				if @dbFile.exists then @dbFile.deleteFile()
				@open false, (err) =>
					log 'Open in verify:', err
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
			@db.addEventListener 'close', (event) =>
				log 'Closed event'
				setTimeout () =>
					log 'Should be closed'
					afterClose()
				, 1000
			@db.close()
			log 'DB closed'
		on_schema = (event) =>
			@db.removeEventListener air.SQLEvent.SCHEMA, on_schema
			tables = @db.getSchemaResult()?.tables ? []
			log 'Got schema', tables, schema, @clean
			@clean = no
			@tables = []
			for table in tables
				# log 'Now schema:', table.name
				@tables.push table.name
			# log 'Need clean', @clean
			if @clean
				do_reset_schema()
			else
				handler null
		@db.addEventListener air.SQLEvent.SCHEMA, on_schema
		@db.addEventListener air.SQLErrorEvent.ERROR, err
		@db.loadSchema air.SQLTableSchema
		log 'Requested schema'

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
		arr = air.EncryptedLocalStore.getItem name
		if not name then return def
		try
		  return arr.readUTF()
		catch error
		return def  

	is: (name, def) ->
		arr = air.EncryptedLocalStore.getItem name
		if not name then return def ? no
		try
		  return arr.readUTF()
		catch error
		return def is yes or def is 'true' or def is 'yes'

	set: (name, value) ->
		if not name then return no
		if not value
			air.EncryptedLocalStore.removeItem name
		arr = new air.ByteArray()
		arr.writeUTF(''+value)
		air.EncryptedLocalStore.setItem name, arr

class HTML5Provider extends DBProvider
	open: (clean, handler) ->
		return handler 'HTML5 DB not supported' unless window and window.openDatabase
		# log 'Ready to open'
		try
			@db = window.openDatabase env.prefix+@name, '', env.prefix+@name, 1024 * 1024 * 10
			log 'Opened', @db.version, @version
			@version_match = yes
			@clean = clean
			handler null
		catch error
			handler error.message

	_query: (query, params, transaction, handler) ->
		# log 'SQL:', query, params
		transaction.executeSql query, params, (transaction, result) =>
			data = []
			for i in [0...result.rows.length]
				obj = {}
				for own key, value of result.rows.item i
					obj[key] = value if value
				data.push obj
			# log 'Query result:', data
			handler null, data, transaction
		, (transaction, error) =>
			log 'Error SQL', query, error
			handler error.message

	query: (query, params, handler, transaction) ->
		if not @db
			handler "DB isn't opened" unless @db
			return
		if transaction
			@_query query, params, transaction, handler
			return transaction
		else
			@db.transaction (transaction) =>
				# log 'Ready to query', transaction
				@_query query, params, transaction, handler
			, (error) =>
				log 'Error transaction', error
				handler error.message
			return null

	verify: (schema, handler) ->
		# log 'verify', schema
		@query 'select name, type from sqlite_master where type=? or type=? order by type desc', ['table', 'index'], (err, res, tr) =>
			log	'SQL result', err, res, tr
			if err
				return handler err
			@tables = []
			for row in res
				if row.type is 'table' and not (_.startsWith(row.name, 'sqlite_') or _.startsWith(row.name, '_'))
					@tables.push row.name
			# log 'verify @tables', @tables, @version_match, @clean
			if not @version_match or @clean or (@tables.length is 0)
				@clean = yes
				# drop tables/etc
				create_at = (index) =>
					if index < schema.length
						log 'Create SQL:', schema[index]
						@query schema[index], [], (err) =>
							if err
								return handler err
							create_at index+1
						, tr
					else
						log 'Changing version [', @db.version, ']=>[', @version, ']'
						if not @version_match
							log 'Do change *'
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
							log 'No change'
							handler null, false
				drop_at = (index) =>
					if index < res.length
						if res[index].name.substr(0, 2) is '__' or res[index].name.substr(0, 7) is 'sqlite_'
							return drop_at index+1
						# log 'Drop ', res[index].type, res[index].name
						@query 'drop '+res[index].type+' if exists '+res[index].name, [], (err) =>
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
		val = window?.localStorage[env.prefix+name]
		if not val then val = def
		return val

	is: (name, def = no) ->
		val = window?.localStorage[env.prefix+name] ? def
		if not val
			return def ? no
		return val is yes or val is 'true' or val is 'yes'

	set: (name, value) ->
		window?.localStorage[env.prefix+name] = value

class StorageProvider

	last_id: 0
	db_schema: ['create table if not exists updates (id integer primary key, version_in integer, version_out integer, version text)', 'create table if not exists schema (id integer primary key, token text, schema text)', 'create table if not exists uploads (id integer primary key, path text, name text, status integer)']
	data_template: '(id integer primary key, status integer default 0, updated integer default 0, own integer default 1, stream text, data text'

	SYNC_NETWORK: 0
	SYNC_READ_DATA: 1
	SYNC_WRITE_DATA: 2

	constructor: (@db) ->
		@on_channel_state = new EventEmitter this

	open: (handler) ->
		@db.open false, (err) =>
			log 'StorageProvider::Open result:', err
			if not err
				@db.verify @db_schema, (err, reset) =>
					log 'StorageProvider::Verify result', err, reset
					if err then return handler err
					@db.query 'select schema, token from schema', [], (err, data) =>
						# log 'Schema', err, data
						if err then return handler err
						if data.length>0
							@schema = JSON.parse data[0].schema
							@token = data[0].token
						handler null
	
	get: (name, def) ->
		return @db.get name, def

	set: (name, value) ->
		return @db.set name, value

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
	
	sync: (app, oauth, handler, force_clean, progress_handler) ->
		# log 'Starting sync...', app
		oauth.token = @token
		reset_schema = no
		clean_sync = no
		in_from = 0
		out_from = 0
		out_items = 0
		in_items = 0
		finish_sync = (err) =>
			if err then return handler err
			@has_update = no
			if @channel and @channel.is_connected()
				@on_channel_state.emit 'state', {state: @CHANNEL_NO_DATA}
			progress_handler @SYNC_WRITE_DATA
			@db.query 'insert into updates (id, version_in, version_out) values (?, ?, ?)', [@_id(), in_from, out_from], () =>
				for name, item of @schema
					if name?.charAt(0) == '_' then continue
					@db.query 'delete from t_'+name+' where status=?', [3], () =>
				handler err, {
					in: in_items
					out: out_items
				}
		upload_file = () =>
			if _.indexOf(@db?.tables, 'uploads') is -1 or not @cache
				return send_in null
			progress_handler @SYNC_READ_DATA
			@db.query 'select id, name, status from uploads order by id limit 1', [], (err, data) =>
				if err then return finish_sync err
				if data.length is 0 then return send_in null
				row = data[0]
				remove_entry = () =>
					progress_handler @SYNC_WRITE_DATA
					@cache.remove row.name, () =>
					@db.query 'delete from uploads where id=?', [row.id], (err, res) =>
						if err then return finish_sync err
						upload_file null
				progress_handler @SYNC_NETWORK
				if row.status is 3
					oauth.rest app, '/rest/file/remove?name='+row.name+'&', null, (err, res) =>
						if err then return finish_sync err
						remove_entry null
				else
					@cache.upload row.name, (err) =>
						if err then return finish_sync err
						remove_entry null

		receive_out = (transaction) =>
			url = "/rest/out?from=#{out_from}&"
			if not clean_sync
				url += "inc=yes&"
			progress_handler @SYNC_NETWORK
			oauth.rest app, url, null, (err, res) =>
				# log 'receive_out', transaction
				if err then return finish_sync err
				progress_handler @SYNC_WRITE_DATA
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
							tr = @create item.s, object, (err, _data, tr) =>
								# log 'After create', err
								if last
									receive_out null
							, {
								status: item.st
								updated: item.u
								own: 0
								internal: yes
							}
		send_in = () =>
			progress_handler @SYNC_READ_DATA
			if force_clean then return do_reset_schema null
			slots = @schema._slots ? 10
			sql = []
			vars = []
			for name, item of @schema
				if name?.charAt(0) == '_' then continue
				if _.indexOf(@db.tables, 't_'+name) is -1 then continue
				sql.push 'select id, stream, data, updated, status from t_'+name+' where own=? and updated>?'
				vars.push 1
				vars.push in_from
			if sql.length is 0 then return do_reset_schema null
			@db.query sql.join(' union ')+' order by updated limit '+slots, vars, (err, data, tr) =>
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
				progress_handler @SYNC_NETWORK
				oauth.rest app, '/rest/in?', JSON.stringify({a: result}), (err, res) =>
					# log 'After in:', err, res
					if err then return finish_sync err
					send_in null
		do_reset_schema = () =>
			progress_handler @SYNC_WRITE_DATA
			@db.clean = yes
			new_schema = []
			for item in @db_schema
				new_schema.push item
			for name, item of @schema
				fields = id: 'id'
				if name?.charAt(0) == '_' then continue;
				numbers = item.numbers ? []
				texts = item.texts ? []
				sql = 'create table if not exists t_'+name+' '+@data_template
				for field in numbers
					sql += ', f_'+field+' integer'
				for field in texts
					sql += ', f_'+field+' text'
				new_schema.push sql+')'
				indexes = item.indexes ? []
				index_idx = 0
				for index in indexes
					index_sql = 'create index i_'+name+'_'+(index_idx++)+' on t_'+name+' (status';
					for index_field in index
						index_sql += ', f_'+index_field;
					new_schema.push index_sql+')'
			@db.verify new_schema, (err, reset) =>
				# log 'Verify result', err, reset
				if err then return finish_sync err
				out_from = 0
				@db.query 'insert into schema (id, token, schema) values (?, ?, ?)', [@_id(), @token, JSON.stringify @schema], (err, data, tr) =>
					if err then return handler err
					receive_out null
		get_last_sync = () =>
			progress_handler @SYNC_READ_DATA
			if _.indexOf(@db?.tables, 'updates') is -1
				return upload_file null
			@db.query 'select * from updates order by id desc', [], (err, data) =>
				if err then return finish_sync err
				if data.length>0
					in_from = data[0].version_in or 0
					out_from = data[0].version_out or 0
					if not clean_sync and out_from>0 then clean_sync = no
				# log 'Start sync with', in_from, out_from
				upload_file null
		schema_uri = '/rest/schema?'
		if @channel and @channel.need_channel()
			schema_uri += 'channel=get&type='+@channel.type+'&'
		progress_handler @SYNC_NETWORK
		oauth.rest app, schema_uri, null, (err, schema) =>
			# log 'After schema', err, schema
			if err then return finish_sync err
			if @channel and schema._channel
				@channel.on_channel schema._channel
			if not @schema or @schema._rev isnt schema._rev or force_clean
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

	CHANNEL_DATA: 1
	CHANNEL_NO_DATA: 2
	CHANNEL_NO_CONNECTION: 3

	set_channel_provider: (@channel) ->
		@channel.on_update = (message) =>
			@has_update = yes
			@on_channel_state.emit 'state', {state: @CHANNEL_DATA} 
		@channel.on_connected = () =>
			if @has_update
				@on_channel_state.emit 'state', {state: @CHANNEL_DATA}
			else
				@on_channel_state.emit 'state', {state: @CHANNEL_NO_DATA}
		@channel.on_disconnected = () =>
			@on_channel_state.emit 'state', {state: @CHANNEL_NO_CONNECTION}
		# @on_channel_state.emit 'state', {state: @CHANNEL_NO_CONNECTION}

	on_change: (type, stream, id) ->

	uploadFile: (path, handler) ->
		if not @cache then return handler 'Not supported'
		fileName = @cache.path_to_name path
		dotloc = fileName.lastIndexOf '.'
		ext = '.bin'
		if dotloc isnt -1 then ext = fileName.substr dotloc
		name = ''+@_id()+ext.toLowerCase()
		@cache.store name, path, (err) =>
			if err then return handler err
			@db.query 'insert into uploads (id, path, name, status) values (?, ?, ?, ?)', [@_id(), fileName, name, 1], (err) =>
				if err then return handler err
				handler null, name

	getFile: (name, handler) ->
		if not @cache then return handler 'Not supported'
		@cache.oauth.token = @token
		@cache.get name, (err, uri) =>
			if err then return handler err
			handler null, uri

	removeFile: (name, handler) ->
		if not @cache then return handler 'Not supported'
		@cache.remove name, () =>
			@db.query 'select id from uploads where name=? and status=?', [name, 1], (err, data) =>
				if err then return handler err
				query = null
				vars = null
				if data.length>0
					query = 'delete from uploads where name=?'
					vars = [name]
				else
					query = 'insert into uploads (id, path, name, status) values (?, ?, ?, ?)'
					vars = [@_id(), null, name, 3]
				@db.query query, vars, (err) =>
					handler err

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
			fields += ', f_'+numbers[i]
			values.push object[numbers[i]] ? null
		for i in [0...texts.length]
			questions += ', ?'
			fields += ', f_'+texts[i]
			values.push object[texts[i]] ? null
		return @db.query 'insert or replace into t_'+stream+' ('+fields+') values ('+questions+')', values, (err, _data, transaction) =>
			if err
				handler err
			else 
				if not options?.internal then @on_change 'create', stream, object.id
				handler null, object, transaction
		, options?.transaction

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
			fields += ', f_'+numbers[i]+'=?'
			values.push object[numbers[i]] ? null
		for i in [0...texts.length]
			fields += ', f_'+texts[i]+'=?'
			values.push object[texts[i]] ? null
		values.push object.id
		values.push stream
		@db.query 'update t_'+stream+' set '+fields+' where id=? and stream=?', values, (err) =>
			if not err
				@on_change 'update', stream, object.id
			handler err

	remove: (stream, object, handler) ->
		if not @_precheck stream, handler then return
		if not object or not object.id
			return handler 'Invalid object ID'
		@db.query 'update t_'+stream+' set status=?, updated=?, own=? where  id=? and stream=?', [3, @_id(new Date().getTime()), 1, object.id, stream], (err) =>
			if not err
				@on_change 'remove', stream, object.id
			handler err

	select: (stream, query, handler, options) ->
		if not @_precheck stream, handler then return
		extract_fields = (stream) =>
			numbers = @schema[stream]?.numbers ? []
			fields = id: 'id'
			for own i, name of @schema[stream]?.texts ? []
				fields[name] = 'f_'+name
			for own i, name of @schema[stream]?.numbers ? []
				fields[name] = 'f_'+name
			return fields
		fields = extract_fields stream
		values = [3]
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
								values.push 3
								wherePart = array_to_query(f, value.query ? [])
								result.push(''+fields[name]+' in (select '+f[value.field]+' from t_'+value.stream+' where status<>?'+(if wherePart then ' and '+wherePart else '')+')')
							else
								# custom op
								if value.var
									result.push fields[name]+' '+value.op+' ?'
									values.push value.var ? null
								else
									result.push fields[name]+' '+value.op
						else
							#equal
							result.push fields[name]+'=?'
							values.push value ? null
					i++
			if result.length>0
				return '('+(result.join ") #{op} (")+')'
			else
				return null
		where = array_to_query fields, query ? []
		group_by = []
		if options?.group # Have group by
			arr = options?.group
			if not $.isArray(arr) then arr = [arr]
			for ar in arr
				if fields[ar] or 'id' == ar then group_by.push fields[ar]
		order = []
		need_id = yes
		if options?.order
			arr = options?.order
			if not $.isArray(arr)
				arr = [arr]
			for ar in arr
				asc = 'asc'
				# log 'ar', ar, ar?.charAt
				if ar?.charAt and ar?.charAt(0) is '!'
					ar = ar.substr 1
					asc = 'desc'
				if fields[ar] or 'id' == ar 
					order.push fields[ar]+' '+asc
					if ar is 'id' then need_id = no
		if options?.group # Have group by -> don't need id in order
			need_id = no
		if need_id then order.push 'id asc'
		limit = ''
		if options?.limit
			limit = ' limit '+options?.limit
		sql = 'select '
		if options?.field # have field - not data
			if options?.distinct # distinct
				sql += 'distinct '
			sql += 'f_'+options?.field
		else
			sql += 'data'
		# log 'query', sql, stream, where, values
		@db.query sql+' from t_'+stream+' where status<>? '+(if where then 'and '+where else '')+(if group_by.length>0 then ' group by '+group_by.join(',') else '')+' order by '+(order.join ',')+limit, values, (err, data) =>
			if err then return handler err
			result = []
			for item in data
				if options?.field # Only one field - no parse
					itm = {}
					itm[options?.field] = item['f_'+options?.field]
					result.push itm
				else # default - parse
					try
						result.push JSON.parse(item.data)
					catch err
			handler null, result		

class DataManager

	constructor: (@app, @oauth, @storage) ->
		@on_sync = new EventEmitter this
		@oauth.on_new_token = (token) =>
			@storage.set_token token
		@storage.on_channel_state.on 'state', (evt) =>
			@on_channel_state evt.state

		
	sync_timeout: 30
	channel_timeout: 60*15
	timeout_id: null
	in_sync: no

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

	on_channel_state: (state) ->
		if state is @storage.CHANNEL_NO_CONNECTION
			@schedule_sync()
		if not @timeout_id and state is @storage.CHANNEL_DATA
			log 'Scheduling sync because of channel'
			@timeout_id = setTimeout () =>
				@on_scheduled_sync null
			, 1000*@channel_timeout

	get_backup_url: (type, from) ->
		dt = new Date();
		fname = "#{@app}-#{type}-"+dt.format('yymmdd-HHMM')+'.zip'
		url = "/rest/backup?fname=#{fname}&type=#{type}&"
		if from then url += 'from='+from+'&'
		return @oauth.getFullURL(@app, url)

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

	is: (name, def) ->
		return @storage.db.is name, def

	set: (name, value) ->
		return @storage.db.set name, value

	sync: (handler, force_clean, progress_handler = () ->) ->
		if @in_sync then return no
		@in_sync = yes
		@on_sync.emit 'start'
		return @storage.sync @app, @oauth, (err, data) =>
			@in_sync = no
			@on_sync.emit 'finish'
			if not err and @timeout_id
				@unschedule_sync null
			handler err, data
		, force_clean, progress_handler

	restore: (files, handler) ->
		xhr = new XMLHttpRequest()
		url = '/rest/restore?'
		xhr.open 'POST', @oauth.getFullURL(@app, url), yes
		formData = new FormData()
		i = 0
		for file in files
			formData.append "file#{i}", file
			i++
		xhr.onload = (e) =>
			log 'Upload done', e, xhr.status
			if xhr.status isnt 200
				handler 'HTTP error'
			else
				handler null
		xhr.onerror = (e) =>
			log 'XHR error', e, arguments
			handler 'HTTP error'
		xhr.send formData


window.HTML5Provider = HTML5Provider
window.AirDBProvider = AirDBProvider
window.StorageProvider = StorageProvider
window.Lima1DataManager = DataManager
window.AirCacheProvider = AirCacheProvider
window.PhoneGapCacheProvider = PhoneGapCacheProvider
window.DesktopChannelProvider = DesktopChannelProvider
window.HTML5CacheProvider = HTML5CacheProvider
window.env =
	mobile: no
	prefix: ''
