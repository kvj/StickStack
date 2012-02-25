var Storage = function(fileName) {//Handles localstorage
    this.session = {};
    if (CURRENT_PLATFORM == PLATFORM_AIR) {//Load preferences file
        this.storage = {};
        var prefsFile = air.File.applicationStorageDirectory;
        this.fileName = fileName || 'preferences.txt';
        prefsFile = prefsFile.resolvePath(this.fileName);
        var stream = new air.FileStream();
        try {
            stream.open(prefsFile, 'read');
            while (stream.bytesAvailable>0) {//For every line
                var line = stream.readUTF();
                //log('line', line);
                var eq = line.indexOf('=');
                if (eq != -1) {//key = value
                    //log('Read from file:', _.trim(line.substr(0, eq)), _.trim(line.substr(eq+1)));
                    this.storage[_.trim(line.substr(0, eq))] = _.trim(line.substr(eq+1));
                };
            };
            stream.close();
        } catch (e) {//File read error
            log('Error loading config', e);
        } finally {
            stream.close();
        }
        this._saveStorage = function() {//Saves storage in Air
            var prefsFile = air.File.applicationStorageDirectory;
            prefsFile = prefsFile.resolvePath(this.fileName);
            var stream = new air.FileStream();
            try {
                stream.open(prefsFile, 'write');
                var keys = _.keys(this.storage);
                for (var i in keys) {//Save key = value pairs
                    if (this.storage[keys[i]] || this.storage[keys[i]] == 0) {//Not empty
                        stream.writeUTF(keys[i] + ' = ' + this.storage[keys[i]]+'\n');
                    };
                };
                stream.close();
            } catch (e) {//File read error
                log('Error saving config', e);
            } finally {
                stream.close();
            }
        };
    };
}

Storage.prototype.getObject = function(name, def) {//Returns JSON object
    try {
        return JSON.parse(this.getString(name, def || {})) || def || {};
    } catch (e) {//JSON error
        return def || {};
    }
};

Storage.prototype.getString = function(name, def, session) {//Returns string
    if (this.session[name] || session) {//
        return this.session[name];
    };
    switch(CURRENT_PLATFORM) {
        case PLATFORM_TIT:
            return Titanium.App.Properties.getString(name, def || '')
        case PLATFORM_WEB:
            return localStorage[name] || def
        case PLATFORM_AIR:
            return this.storage[name] || def
    };
    return def || null;
};

Storage.prototype.clear = function(name, session) {//Returns string
    if (this.session[name] && session) {//
        delete this.session[name];
        return;
    };
    switch(CURRENT_PLATFORM) {
        case PLATFORM_TIT:
            log('!!!Not implemented');
            return Titanium.App.Properties.getString(name, def || '')
        case PLATFORM_WEB:
            delete localStorage[name];
            return;
        case PLATFORM_AIR:
            delete this.storage[name];
            this._saveStorage();
            return;
    };
};

Storage.prototype.getInt = function(name, def) {//Returns int
    if (this.session[name]) {//Have local version
        return parseInt(this.session[name]);
    };
    switch(CURRENT_PLATFORM) {
        case PLATFORM_TIT:
            return parseInt(Titanium.App.Properties.getString(name, ''+def || '0')) || def || 0;
        case PLATFORM_WEB:
            var val = parseInt(localStorage[name]);
            if (val || val == 0) {//Value
                return val;
            };
            return def || 0;
        case PLATFORM_AIR:
            var val = parseInt(this.storage[name]);
            if (val || val == 0) {//Value
                return val;
            };
            return def || 0;
    };
    return def || 0;
};

Storage.prototype.setObject = function(name, value, session) {//Sets object
    return this.setString(name, JSON.stringify(value), session);
};

Storage.prototype.setString = function(name, value, session) {//Sets string
    if (session) {//Have local version
        this.setString(name, '', false);
        this.session[name] = value || '';
        return;
    };
    switch(CURRENT_PLATFORM) {
        case PLATFORM_TIT:
            Titanium.App.Properties.setString(name, value? value.replace(/\\/g, '/'): '');
            return;
        case PLATFORM_WEB:
            localStorage[name] = value || '';
            return;
        case PLATFORM_AIR:
            this.storage[name] = value || '';
            this._saveStorage();
            return;
    };
};

Storage.prototype.setInt = function(name, value, session) {//Sets int
    //log('setInt', name, value, session);
    if (session) {//Have local version
        this.setInt(name, 0, false);
        this.session[name] = value || 0;
        return;
    };
    switch(CURRENT_PLATFORM) {
        case PLATFORM_TIT:
            Titanium.App.Properties.setString(name, ''+(value || 0))
            return;
        case PLATFORM_WEB:
            localStorage[name] = value || 0;
            return;
        case PLATFORM_AIR:
            this.storage[name] = value || 0;
            this._saveStorage();
            return;
    };
};

Storage.prototype.set = function(obj, session) {//Saves all properties of object
    var names = _.keys(obj);
    for (var i = 0; i < names.length; i++) {
        this.setString(names[i], obj[names[i]], session);
    };
}

var Database = function(config){
    this.config = config || {};
    this.dbName = this.config.name || ':untitled';
    this.tables = {};
    this.indexes = {};
    this.db = null;
    this.sync = this.config.sync || false;
    this.client = this.config.client;
    if (this.sync && !this.client) {
        log('Sync is enabled but no client ID provided!');
        this.sync = false;
    };
    this.syncs = {};
    this.limits = {};
    this.on_start = null;
    this.on_end = null;
    this.undos = [];
    this.undoID = 1;
    this.tasksRunning = 0;
    this.lastID = 0;
    this.storage = this.config.storage || null;
    if (this.config.helper) {//We have helper - stop initialization
        return;
    };
    log('Creating BD:', this.dbName, CURRENT_PLATFORM);
    if (_.startsWith(this.dbName, ':')) {//DB in default directory
        this.dbName = this.dbName.substr(1);
        switch(CURRENT_PLATFORM) {
            case PLATFORM_TIT:
                this.dbPath = this.dbName;
                break;
            case PLATFORM_WEB:
                this.dbPath = this.dbName;
                break;
            case PLATFORM_AIR:
                var prefsFile = air.File.applicationStorageDirectory;
                this.dbPath = prefsFile.resolvePath(this.dbName+'.db');
                break;
        };
    } else {//Absolute path
        this.dbPath = this.dbName;
        if (CURRENT_PLATFORM == PLATFORM_AIR) {//Convert string to File
            try {
                if (this.config.relative) {//Relative path from dist
                    this.dbPath = air.File.applicationDirectory.resolvePath(this.dbName);
                } else {//Absolute path
                    this.dbPath = new air.File(this.dbPath);
                };
            } catch (e) {//File error
            }
        };
    };
};

Database.prototype.close = function() {//Close DB
    switch(CURRENT_PLATFORM) {
        case PLATFORM_TIT:
            this.db.close();
            break;
        case PLATFORM_WEB:
            break;
        case PLATFORM_AIR:
            this.db.close();
            break;
    };
};

Database.prototype.open = function(on_ok, on_err){
    if (this.config.helper) {//Helper
        return this.config.helper.open(_.bind(function() {//DB open
            this.instance.init(this.on_ok, this.on_err);
        }, {instance: this, on_ok: on_ok, on_err: on_err}), on_err, this);
    };
    try {
        switch(CURRENT_PLATFORM) {
            case PLATFORM_TIT:
                this.db = Titanium.Database.open(this.dbPath);
                break;
            case PLATFORM_WEB:
                if (CURRENT_PLATFORM_MOBILE && !_.startsWith(this.config.name, ':')) {//Assets
                    this.db = DroidDB_openDatabase('file:///android_asset/www/'+this.dbPath, '1.0', this.config.display_name || 'assetsdb', this.config.size || 0);
                } else {//
                    this.db = openDatabase(this.dbPath, '1.0', this.dbPath, 512*1024);
                };
                break;
            case PLATFORM_AIR:
                this.db = new air.SQLConnection();
                this.db.addEventListener(air.SQLEvent.OPEN, _.bind(function(evt) {//
                    this.db.db.removeEventListener(air.SQLErrorEvent.ERROR, this.on_err);
                    if (this.db.config.asis) {//Call ok and exit
                        if (this.on_ok) {//
                            this.on_ok(this.db);
                        };
                        return;
                    };
                    this.db.init(this.on_ok, this.on_err);
                }, {db: this, on_ok: on_ok, on_err: on_err}));
                this.db.addEventListener(air.SQLErrorEvent.ERROR, on_err);
                var encryptionKey = null;
                //if (this.config.password) {//Add key
                    //var encryptionKey = new air.ByteArray();
                    //log('Pass: ', sha1.hex_md5(this.config.password).substr(0, 16));
                    //encryptionKey.writeUTFBytes(sha1.hex_md5(this.config.password).substr(0, 16));
                //};
                this.db.openAsync(this.dbPath, 'create', null, false, 1024, encryptionKey);
                return;
        };
    } catch (e) {
        this.db = null;
        if (on_err) {
            on_err(e);
        };
        return;
    }
    if (this.config.asis) {//Call ok and exit
        if (on_ok) {//
            on_ok(this);
        };
        return;
    };
    return this.init(on_ok, on_err);
};

Database.prototype.addTable = function(name, rows, sync, limit){
    if (this.sync && sync) {//Enable sync for table
        this.syncs[name.toLowerCase()] = true;
        this.limits[name.toLowerCase()] = limit || 0;
        rows['_sync_date_modified'] = {number: true};
        //rows['_sync_update'] = {number: true};
        rows['_sync_client'] = true;
        rows['_sync_delete'] = {number: true};
    };
    this.tables[name.toLowerCase()] = rows;
};

Database.prototype.addIndex = function(name, table, rows){
    this.indexes[name.toLowerCase()] = {table: table, rows: rows};
};

Database.prototype.dbExecAir = function(sql, params, cb, cb_err, tr) {//Air version of exec
    try {
        var stmt = new air.SQLStatement();
        stmt.sqlConnection = this.db;
        for (var i = 0; i < params.length; i++) {//Copy params
            stmt.parameters[i] = params[i];
        };
        stmt.text = sql;
        var ctx = {
            on_ok: cb,
            on_err: cb_err,
            stmt: stmt
        };
        stmt.addEventListener(air.SQLEvent.RESULT, _.bind(function(evt) {//Query completed
            var result = this.stmt.getResult();
            var data = [];
            if (result && result.data) {//Return
                data = result.data;
            };
            if (params._id) {//Result received
                data.lastID = params._id;
            };
            if (this.on_ok) {
                this.on_ok(data);
            };
        }, ctx));
        stmt.addEventListener(air.SQLErrorEvent.ERROR, _.bind(function(evt) {//Query failed
            if (this.on_err) {
                this.on_err(evt.error.details);
            };
        }, ctx));
        stmt.execute();
    } catch (e) {//SQL error
        log('Error:', e);
        if(cb_err) {
            cb_err(e);
        }
    }
};

Database.prototype.dbExecHTML5 = function(sql, params, cb, cb_err, tr) {
    try {
        var on_ok = function(t) {
            t.executeSql(sql, params || [], function(t, r) {
                if(cb) {
                    var result = [];
                    for(var i = 0; i<r.rows.length; i++) {
                        result.push(r.rows.item(i));
                    };
                    if ('insertId' in r && _.startsWith(sql, 'insert')) {//Have insertId
                        result.lastID = params._id || r.insertId || null;
                    };
                    cb(result, t);
                }
            }, function(t, err) {
                if(cb_err) {
                    cb_err(err);
                }
            });
        };
        if (tr) {//Existing transaction
            on_ok(tr);
        } else {//New transaction
            this.db.transaction(on_ok, cb_err || function(){});
        };
    } catch (e) {
        log('Error: '+e.message);
        if(cb_err) {
            cb_err(e);
        }
    }
}

Database.prototype.incTasksRunning = function() {
    if (this.tasksRunning<=0) {
        this.tasksRunning = 1;
        if (this.on_start) {//Handler
            this.runningObject = this.on_start(this);
        };
    } else {
        this.tasksRunning++;
    };
};

Database.prototype.decTasksRunning = function() {
    if (this.tasksRunning<=1) {
        this.tasksRunning = 0;
        if (this.on_end) {//Handler
            this.on_end(this.runningObject);
        };
    } else {
        this.tasksRunning--;
    };
};

Database.prototype.undo = function(on_ok, on_err) {//Do undo
    if (this.undos.length == 0) {//History is empty
        if (on_ok) {//Have handler
            on_ok(false);
        };
        return;
    };
    var undoID = this.undos[this.undos.length-1].id;
    var gr = new AsyncGrouper(0, _.bind(function(gr) {//All operations done
        //Check result
        var resultOK = true;
        var error = null;
        for (var i = 0; i < gr.statuses.length; i++) {//Check
            if (!gr.statuses[i]) {//Query failed
                resultOK = false;
                error = gr.results[i][0];
                break;
            };
        };
        if (!resultOK) {//Call handler
            if (this.err) {
                this.err(error);
            };
        } else {//OK
            if (this.ok) {
                this.ok(true);
            };
        };
    }, {ok: on_ok, err: on_err}));
    while (this.undos.length>0 && this.undos[this.undos.length-1].id == undoID) {//Do all ops for this undoID
        var undo = this.undos[this.undos.length-1];
        var q = null;
        var vals = [];
        if (undo.type == 'delete') {//Construct delete
            q = 'delete from "'+undo.table+'" where "id"=?';
            vals.push(undo.row_id);
        };
        if (undo.type == 'update') {//Make update
            q = 'update "'+undo.table+'" set ';
            for (var i = 0; i < undo.fields.length; i++) {//Add =?
                if (i != 0) {//add, 
                    q += ', ';
                };
                q += '"'+undo.fields[i]+'"=?';
            };
            vals = undo.values;
            if (undo.where) {//Add where
                q += ' where '+undo.where;
            };
        };
        if (q) {//Have query
            gr.count++;
            log('undo exec', q, vals.length);
            this.exec(q, vals, gr.ok, gr.err);
        };
        this.undos.splice(this.undos.length-1, 1);
    };
};

Database.prototype.batch = function(configs, handler) {//Batch queries
    if (!configs) {
        configs = [];
    };
    if (this.config.helper && this.config.helper.batch) {
        return this.config.helper.batch(configs, handler, this);
    };
    var gr = new AsyncGrouper(configs.length, _.bind(function(gr) {
        var err = gr.findError();
        if (err) {
            //for (var i = 0; i < gr.count; i++) {
                //log('batch', i, gr.count, gr.statuses[i]);
            //};
            return handler(null, err);
        };
        var result = [];
        for (var i = 0; i < gr.count; i++) {//
            result.push(gr.results[i][0]);
        };
        handler(result);
    }, this));
    for (var i = 0; i < configs.length; i++) {
        var conf = configs[i];
        //log('Do batch', i, conf.type, conf.table, conf.fields, conf.values);
        conf.ok = gr.ok;
        conf.err = gr.err;
        this.query(conf);
    };
};

Database.prototype.query = function(config) {//Config version
    if (!config) {//Skip
        return null;
    };
    if (!config.ok) {//Add empty OK
        config.ok = function() {};
    };
    var type = config.type || 'select';
    var ret = 0;
    var undo = {};
    if (config.undo) {//Allocate next undo ID
        undo.id = config.undoID || this.undoID++;
        undo.table = config.table;
    };
    if (type == 'insert') {//Do insert
        this.insert(config.table, config.fields || [], config.values || [], _.bind(function(data, tr) {//After insert
            if (this.undo.id) {//Save undo
                data.undoID = this.undo.id;
                this.undo.type = 'delete';
                this.undo.row_id = data.lastID;
                this.instance.undos.push(this.undo);
            };
            this.config.ok(data, tr);
        }, {config: config, instance: this, undo: undo}), config.err, config.tr, config.direct, config);
        return;
    };
    if (type == 'update') {//Do update
        this.update(config.table, config.fields || [], config.values || [], config.where || null, _.bind(function(data, tr) {//Updated
            if (this.undo.id && this.config.undo.fields && this.config.undo.values) {//Save undo
                data.undoID = this.undo.id;
                this.undo.type = 'update';
                this.undo.fields = this.config.undo.fields || [];
                this.undo.values = this.config.undo.values;
                this.undo.where = this.config.where;
                this.instance.undos.push(this.undo);
            };
            this.config.ok(data, tr);
        }, {config: config, instance: this, undo: undo}), config.err, config.tr, config.direct, config);
        return;
    };
    if (type == 'delete' || type == 'remove') {//Do remove
        this.remove(config.table, config.where || null, config.values || [], _.bind(function(data, tr) {//Removed (updated)
            if (this.undo.id) {//Save undo
                data.undoID = this.undo.id;
                this.undo.type = 'update';
                this.undo.fields = ["_sync_delete"];
                this.undo.values = [0];
                if (this.config.values) {//Copy values
                    for (var i = 0; i < this.config.values.length; i++) {
                        this.undo.values.push(this.config.values[i]);
                    };
                };
                this.undo.where = this.config.where;
                this.instance.undos.push(this.undo);
            };
            this.config.ok(data, tr);
        }, {config: config, instance: this, undo: undo}), config.err, config.tr, config.direct, config);
        return;
    };
    //Do exec
    this.exec(config.query, config.values || [], config.ok, config.err, config.tr, config.direct, config);
};

Database.prototype.exec = function(sql, params, _on_ok, _on_err, tr, direct, config) {//Makes SQL query
    //log('SQL exec:', sql, params.length, _on_ok? true: false, _on_err? true: false);
    var on_ok = _on_ok || function() {};
    var on_err = _on_err || function() {};
    var ctx = {
        on_ok: on_ok,
        on_err: on_err,
        instance: this
    };
    this.incTasksRunning();
    on_ok = _.bind(function(data, tr) {
        this.on_ok(data || [], tr);
        this.instance.decTasksRunning();
    }, ctx);
    on_err = _.bind(function(err) {
        this.on_err(err);
        this.instance.decTasksRunning();
    }, ctx);
    if (this.config.helper) {//Helper
        return this.config.helper.exec(sql, params, on_ok, on_err, this, direct, config);
    };
    switch(CURRENT_PLATFORM) {
        case PLATFORM_TIT:
            return this.execTi(sql, params, on_ok, on_err, tr);
        case PLATFORM_WEB:
            return this.dbExecHTML5(sql, params, on_ok, on_err, tr);
        case PLATFORM_AIR:
            return this.dbExecAir(sql, params || [], on_ok, on_err, tr);
    };

};

Database.prototype.nextID = function() {//Generates next ID
    var id = new Date().getTime();
    while (id<=this.lastID) {
        id++;
    };
    this.lastID = id;
    return id;
};

Database.prototype.insert = function(table, fields, values, on_ok, on_err, tr, direct, config) {//Makes sync insert
    if (fields.length != values.length) {//Error
        if (on_err) {
            on_err('Invalid arguments');
        };
        return;
    };
    if (this.syncs[table.toLowerCase()] && !direct) {//Enable sync
        this.putFieldValue(fields, values, -1, '_sync_date_modified', this.nextID())
        this.putFieldValue(fields, values, -1, '_sync_client', config && config.client? config.client: this.client)
    };
    var sfields = '';
    var svalues = '';
    var id_found = false;
    for (var i = 0; i < fields.length; i++) {//Construct SQL
        if (i>0) {//Add comma
            sfields += ',';
            svalues += ',';
        };
        if (fields[i] == 'id') {//ID
            id_found = true;
            values._id = values[i];
        };
        sfields += '"'+fields[i]+'"';
        svalues += '?';
    };
    if (!id_found) {//Auto generate ID
        sfields += sfields? ',"id"': '"id"';
        svalues += svalues? ',?': '?';
        values._id = this.nextID();
        values.push(values._id);
    };
    var sql = 'insert or replace into "'+table+'" ('+sfields+') values ('+svalues+')';
    return this.exec(sql, values, on_ok, on_err, tr, direct, config);
};

Database.prototype.putFieldValue = function(fs, vs, index, name, value) {//Adds new value
    for (var i = 0; i < fs.length; i++) {
        if (fs[i] == name) {//Remove
            fs.splice(i, 1);
            vs.splice(i, 1);
            i--;
        };
    };
    if (index != -1) {//splice
        fs.splice(index, 0, name);
        vs.splice(index, 0, value);
    } else {//Push
        fs.push(name);
        vs.push(value);
    };
};

Database.prototype.update = function(table, fields, values, where, on_ok, on_err, tr, direct, config) {//Makes sync update
    var fs = _.clone(fields || []);
    var vals = _.clone(values || []);
    if (this.syncs[table.toLowerCase()] && !direct) {//Enable sync
        this.putFieldValue(fs, vals, 0, '_sync_date_modified', this.nextID())
        this.putFieldValue(fs, vals, 0, '_sync_client', this.client);
    };
    var sfields = '';
    for (var i = 0; i < fs.length; i++) {//Construct SQL
        if (i>0) {//Add comma
            sfields += ',';
        };
        sfields += '"'+fs[i]+'"=?';
    };
    var sql = 'update "'+table+'" set '+sfields+(where? ' where '+where: '');
    return this.exec(sql, vals, on_ok, on_err, tr, direct, config);
};

Database.prototype.remove = function(table, where, values, on_ok, on_err, tr, direct, config) {//Sync delete
    var w = 'where ';
    if (where) {//Have where
        w = ' where '+where+' and ';
    };
    w += '_sync_delete=0'
    if (!this.syncs[table.toLowerCase()] || direct) {//Not sync
        var sql = 'delete from "'+table+'"'+w;
        return this.exec(sql, values, on_ok, on_err, tr, direct, config);
    };
    var vals = _.clone(values || []);
    var id = this.nextID();
    vals.splice(0, 0, config && config.client? config.client: this.client);
    vals.splice(0, 0, id);
    vals.splice(0, 0, id);
    this.exec('update "'+table+'" set "_sync_delete"=?, "_sync_date_modified"=?, "_sync_client"=?'+w, vals, on_ok, on_err, tr, direct, config)
};

Database.prototype.execTi = function(query, params, on_ok, on_err, tr) {//Makes select
    try {
        var arr = [];
        params = params || [];
        for (var i = 0; i < params.length; i++) {//Copy params
            arr.push(params[i]);
        };
        var rs = this.db.execute(query, arr);
        var result = [];
        if (rs) {
            for(;rs.isValidRow(); rs.next()) {
                var obj = {};
                for (var i = 0; i < rs.fieldCount; i++) {//Copy values
                    obj[rs.fieldName(i) || i] = rs.field(i);
                };
                result.push(obj);
            };
            rs.close();
        };
        if (params._id) {//Result received
            result.lastID = params._id;
        };
        if (on_ok) {//
            on_ok(result, null);
        };
    } catch (e) {//
        log('Error:', e);
        if (on_err) {//
            on_err(e);
        };
    }
}

Database.prototype._processSchema = function(etables, eindexes, on_ok, on_err) {//Finish
    var get_row_sql = function(name, params){
        var result = '"'+name+'"';
        var numberType = CURRENT_PLATFORM == PLATFORM_TIT? 'integer': 'float';
        if(params.id){
            result += ' '+numberType+' not null primary key'
        } else if(params.number){
            result += ' '+numberType+' default '+(params.def || 0);
         } else {
            if(params.type)
                result += ' '+params.type;
            else
                result += ' text';
            if(params.notnull)
                result += ' not null';
            if(params.autoinc)
                result += ' autoincrement';
            if(params.def || params.def === 0)
                result += ' default '+params.def;
        }
        return result;
    };
    var sqls = [];
    for(var name in eindexes) {
        if(!this.indexes[name]){
            sqls.push('drop index "'+name+'"');
        }
    }
    for(var name in etables) {
        if(!this.tables[name]){
            sqls.push('drop table "'+name+'"');
        }
    }
    for(var name in this.tables){
        log('process', name, '...');
        var rows = this.tables[name];
        if(etables[name]){
            var erows = etables[name];
            for(var r in rows){
                if(!erows[r.toLowerCase()]){
                    sqls.push('alter table "'+name+'" add '+get_row_sql(r, rows[r]));
                }
            }
        } else {
            var arr = [];
            for(var r in rows){
                arr.push(get_row_sql(r, rows[r]));
            }
            var sql = 'create table "'+name+'" ('+arr.join(', ')+')';
            sqls.push(sql);
        }
    }
    for(var name in this.indexes){
        log('process index', name, '...');
        var index = this.indexes[name];
        var rows = index.rows;
        if(!eindexes[name]){
            var arr = [];
            for(var r in rows){
                arr.push('"'+r+'"'+(rows[r].sort? ' '+rows[r].sort: ''));
            }
            var sql = 'create index "'+name+'" on "'+index.table+'" ('+arr.join(', ')+')';
            sqls.push(sql);
        }
    }
    var gr = new AsyncGrouper(sqls.length, _.bind(function(gr) {//
        var error = gr.findError();
        if (error) {
            if (this.on_err) {
                this.on_err(error);
            };
            return;
        };
        //log('DDL done', this.instance.config.id, this.instance.schemaRevision);
        if (this.instance.config.id && this.instance.schemaRevision && this.instance.storage) {//Save schema
            //log('Saving schemaRevision');
            this.instance.storage.setInt('schema_'+this.instance.config.id, this.instance.schemaRevision);
        }
        if (this.instance.config.helper && this.instance.config.helper.afterInit) {//Run after init
            this.instance.config.helper.afterInit(this.on_ok, this.on_err, this.instance);
        } else {
            if (this.on_ok) {
                this.on_ok(this.instance);
            };
        };
    }, {on_ok: on_ok, on_err: on_err, instance: this}));
    for (var i = 0; i < sqls.length; i++) {
        log('DDL:', sqls[i]);
        this.query({
            type: 'select',
            query: sqls[i],
            ok: gr.ok,
            err: gr.err,
            direct: true
        });
        //this.exec(sqls[i], [], gr.ok, gr.err, null, true);
    };
    gr.check();
};

Database.prototype._loadSchemaAir = function(on_ok, on_err) {//Loads tables and indexes
    var ctx = {
        on_ok: on_ok,
        on_err: on_err,
        db: this
    };
    var onTables = _.bind(function(evt) {//Functions are there
        this.db.db.removeEventListener(air.SQLEvent.SCHEMA, onTables);
        this.db.db.removeEventListener(air.SQLErrorEvent.ERROR, onTables);
        this.tables = {};
        var res = this.db.db.getSchemaResult() || {tables: []};
        for (var i = 0; i < res.tables.length; i++) {//For every table
            var cols = {};
            var t = res.tables[i];
            for (var j = 0; j < t.columns.length; j++) {//For every column
                cols[t.columns[j].name.toLowerCase()] = true;
            };
            this.tables[t.name.toLowerCase()] = cols;
        };
        this.db.db.addEventListener(air.SQLEvent.SCHEMA, onIndexes);
        this.db.db.addEventListener(air.SQLErrorEvent.ERROR, onIndexes);
        this.db.db.loadSchema(air.SQLIndexSchema);
    }, ctx);
    var onIndexes = _.bind(function(evt) {//Indices are arrived
        this.db.db.removeEventListener(air.SQLEvent.SCHEMA, onIndexes);
        this.db.db.removeEventListener(air.SQLErrorEvent.ERROR, onIndexes);
        this.indexes = {};
        var res = this.db.db.getSchemaResult() || {indices: []};
        for (var i = 0; i < res.indices.length; i++) {//For every table
            var t = res.indices[i];
            this.indexes[t.name.toLowerCase()] = true;
        };
        this.db._processSchema(this.tables, this.indexes, this.on_ok, this.on_err);
    }, ctx);
    this.db.addEventListener(air.SQLEvent.SCHEMA, onTables);
    this.db.addEventListener(air.SQLErrorEvent.ERROR, onTables);
    this.db.loadSchema(air.SQLTableSchema);
};

Database.prototype.reset = function(handler) {//Resets local DB. drops all tables, run init again
    var _tables = _.keys(this.tables);
    var gr = new AsyncGrouper(_tables.length, _.bind(function(gr) {//
        var err = gr.findError();
        if (err) {
            return handler(null, err);
        };
        if (this.storage && this.config.id) {//Schema
            this.storage.clear('schema_'+this.config.id);
        };
        this.init(function(db) {//
            handler(db);
        }, function(err) {//
            handler(null, err);
        });
    }, this));
    for (var i = 0; i < _tables.length; i++) {//Drop
        this.query({
            type: 'select',
            query: 'drop table "'+_tables[i]+'"',
            ok: gr.ok,
            err: gr.err
        });
    };
    gr.check();
};

Database.prototype.init = function(on_ok, on_err) {
    if (this.config.id && this.schemaRevision && this.storage && this.storage.getInt('schema_'+this.config.id, 0) == this.schemaRevision) {//Don't need to check schema

        if (this.config.helper && this.config.helper.afterInit) {//Run after init
            this.config.helper.afterInit(on_ok, on_err, this);
        } else {
            if (on_ok) {
                on_ok(this);
            };
        };
        return;
    };
    if (CURRENT_PLATFORM == PLATFORM_AIR && !this.config.helper) {//In case of air use SQLSchema
        return this._loadSchemaAir(on_ok, on_err);
    };
    var sqls = [];
    //Read all existing tables
    //log('existing tables:');
    var instance = this;
    this.exec('select name, sql, type from sqlite_master where type=\'table\' or type=\'index\'', [], function(r, t){
        var etables = {};
        var eindexes = {};
        for(var i = 0; i<r.length; i++) {
            var name = r[i].name;
            if(_.startsWith(name, '__') || _.startsWith(name, 'sqlite_') || name == 'android_metadata'){
                continue;
            }
            //log('row '+r.rows.item(i).name+' = '+r.rows.item(i).sql);
            var sql = r[i].sql.toLowerCase();
            sql = sql.substr(sql.indexOf('(')+1, sql.length);
            sql = sql.substr(0, sql.indexOf(')'));
            var sr = sql.split(',');
            var arr = {};
            for(var j in sr){
                var s = _.trim(sr[j]);
                s = s.substr(0, s.indexOf(' '));
                if(s.charAt(0) == '"' && s.charAt(s.length-1) == '"')
                    s = s.substr(1, s.length-2);
                if(s)
                    arr[s] = true;
            }
            if('index' == r[i].type) {
                eindexes[name.toLowerCase()] = true;
            } else {
                etables[name.toLowerCase()] = arr;
            }
        };
        instance._processSchema(etables, eindexes, on_ok, on_err);
    }, on_err, null, true);
};

Database.prototype.getStatistics = function(_on_ok, _on_err) {//Calculates stat
    var gr = new AsyncGrouper(_.keys(this.syncs).length*3, _.bind(function(gr) {//Stat done
        var stat = {ins: 0, upd: 0, del: 0};
        var haveError = false;
        for (var i = 0; i < gr.results.length; i++) {//Calculate
            if (!gr.statuses[i]) {//Error
                haveError = true;
                break;
            };
            var data = gr.results[i][0];
            if (data.length == 1) {//One row
                stat[data[0].type] += data[0].c;
            };
        };
        if (haveError) {//Query failed
            if (this.on_err) {//Error handler
                this.on_err('One or more queries failed');
            };
        } else {//Calculated
            if (this.on_ok) {//OK handler
                this.on_ok(stat);
            };
        };
    }, {on_ok: _on_ok, on_err: _on_err}));
    for (var id in this.syncs) {//Make remove
        this.exec('select count(*) c, \'ins\' "type" from "'+id+'" where "_sync_update"=0 and "_sync_date_modified"<>0 and "_sync_delete"=0', [], gr.ok, gr.err);
        this.exec('select count(*) c, \'upd\' "type" from "'+id+'" where "_sync_update"<>0 and "_sync_date_modified"<>0 and "_sync_delete"=0', [], gr.ok, gr.err);
        this.exec('select count(*) c, \'del\' "type" from "'+id+'" where "_sync_update"<>0 and "_sync_date_modified"<>0 and "_sync_delete"<>0', [], gr.ok, gr.err);
    };
};

Database.prototype.applyTo = function(db, config) {//Applies changes from one to another
    var gr = new AsyncGrouper(_.keys(this.syncs).length, _.bind(function(gr) {//All changes are selected. Apply to target DB
        var ops = new AsyncGrouper(0, _.bind(function(gr) {//All done
            //Check about errors
            for (var i = 0; i < gr.statuses.length; i++) {//Check errors
                if (!gr.statuses[i]) {//Query failed
                    if (this.config.error) {//Handler
                        this.config.error('Apply failed: '+gr.results[i][0]);
                    };
                    return;
                };
            };
            if (this.config.ok) {//OK handler
                this.config.ok(gr.count);
            };
        }, this));
        for (var i = 0; i < gr.statuses.length; i++) {//Check errors
            if (!gr.statuses[i]) {//Query failed
                if (this.config.error) {//Handler
                    this.config.error('Query failed: '+gr.results[i][0]);
                };
                return;
            };
        };
        for (var i = 0; i < gr.statuses.length; i++) {//Create SQLs
            var data = gr.results[i][0];
            for (var j = 0; j < data.length; j++) {//Create SQLs
                if (data[j]._sync_table) {//Insert or update
                    var is_insert = data[j]._sync_update == 0;
                    if (data[j]._sync_delete != 0) {//Removed element
                        if (!is_insert) {//Existing - do update
                            ops.count++;
                            this.to.exec('update "'+data[j]._sync_table+'" set "_sync_delete"=?, "_sync_date_modified"=? where "id"=?', [data[j]._sync_delete, data[j]._sync_date_modified, data[j].id], ops.ok, ops.err);
                        };//Else - skip - inserted and later removed
                        continue;
                    };
                    var qs = [];
                    var fs = [];
                    var vals = [];
                    var table = this.from.tables[data[j]._sync_table];
                    for (var id in table) {//Create vals etc
                        if (id == '_sync_date_modified' || id == '_sync_client' || id == '_sync_delete') {//Skip reserved words
                            continue;
                        };
                        fs.push(id);
                        vals.push(data[j][id]);
                    };
                    ops.count++;
                    this.to.insert(data[j]._sync_table, fs, vals, ops.ok, ops.err);
                } else {//Delete
                    ops.count++;
                    this.to.remove(data[j].table, '"id"=?', [data[j].row_id], ops.ok, ops.err);
                };
            };
        };
    }, {from: this, to: db, config: config}));
    for (var id in this.syncs) {//Make select
        this.exec('select *, \''+id+'\' "_sync_table" from "'+id+'" where "_sync_date_modified"<>0 order by "_sync_date_modified"', [], gr.ok, gr.err, null, true);
    };
    //this.exec('select * from "_sync_deletes" order by "date_modified"', [], gr.ok, gr.err);//Deletes
};

Database.prototype.copyTo = function(db, config) {//Copies one DB to another according to rules
    this.copyToDB = db;
    this.copyToConfig = config || {};
    //Clean up target DB first
    var removes = new AsyncGrouper(_.keys(this.syncs).length, _.bind(function(gr) {//Removes done
        log('DB clean', gr.count);
        for (var i = 0; i < gr.statuses.length; i++) {//Check that everything is removed
            if (!gr.statuses[i]) {//Query failed
                if (this.copyToConfig.error) {//Have handler
                    this.copyToConfig.error('DB cleanup failed: '+gr.results[i][0]);
                };
                return;
            };
        };
        var tables = this.copyToConfig.tables || {};
        //Create queries for every table
        var grouper = new AsyncGrouper(0, _.bind(function(gr) {//All inserts done
            log('All done', gr.count);
            for (var i = 0; i < gr.count; i++) {//Check statuses
                if (!gr.statuses[i]) {//Insert failed
                    log('Copy failed', i, gr.results[i][0]);
                    if (this.copyToConfig.error) {//Report error
                        this.copyToConfig.error('Copy failed at step '+i+': '+gr.results[i][0]);
                    };
                    return false;
                };
            };
            if (this.copyToConfig.ok) {//Report success
                this.copyToConfig.ok(gr.count);
            };
        }, this));
        var context = {
            from: this,
            to: this.copyToDB,
            config: this.copyToConfig,
            grouper: grouper,
            table: null
        };
        var _defaultSelectInsert = function(data) {//Do insert
            //log('_defaultSelectInsert done', data.length, this.table);
            //inc grouper
            this.grouper.count += data.length;//all inserts
            var fields = [];
            var values = [];
            var quests = [];
            var fs = [];
            var table = this.from.tables[this.table];
            for (var id in table) {//Add fields
                fields.push(id);
                fs.push('"'+id+'"');
                values.push(null);
                quests.push('?');
            };
            var q = quests.join(', ');
            var f = fs.join(', ');
            var t = null;
            if (this.config.tables && this.config.tables[this.table]) {//Special case
                t = this.config.tables[this.table];
            }
            for (var i = 0; i < data.length; i++) {//Do insert via grouper
                var row = data[i];
                //vals = '';
                for (var j = 0; j < fields.length-2; j++) {//Set values
                    values[j] = row[fields[j]];
                    //vals += fields[j]+'='+row[fields[j]]+',';
                };
                values[values.length-1] = 0;
                values[values.length-2] = row.id;
                values[values.length-3] = 0;
                if (t) {//Special case
                    if (t.modify) {//Have modifier
                        var res = t.modify(row);
                        if (res && res.length>0) {//Have modified queries
                            for (var j = 0; j < res.length; j++) {//
                                this.grouper.count++;
                                var _ctx = _.clone(this);
                                _ctx.table = res[j].table || this.table;
                                //log('Exec', res[j].query, _ctx.table, res[j].params[0]);
                                this.from.exec(res[j].query, res[j].params || [], _.bind(_defaultSelectInsert, _ctx), this.grouper.err, null, true);
                            };
                        };//Else - skip
                    };
                };
                //log('To =>', this.table, row["id"], this.offset);
                this.to.exec('insert into "'+this.table+'" ('+f+') values ('+q+')', _.clone(values), this.grouper.ok, this.grouper.err, null, true);
            };
            if (t && t.limit>0) {//Do next step?
                if (data.length == t.limit) {//Need to make next step
                    this.offset += t.limit;
                    this.grouper.count++;
                    this.from.exec('select * from "'+this.table+'" where "_sync_delete"=0 order by "id" limit '+this.offset+', '+t.limit, [], _.bind(_defaultSelectInsert, this), this.grouper.err, null, true);
                };
            };
            this.grouper.ok(data);
        };
        for (var id in this.syncs) {//Select all - insert all
            var ctx = _.clone(context);
            ctx.table = id;
            var conf = tables[id];
            if (!conf) {//No config - default
                grouper.count++;
                this.exec('select * from "'+id+'" where "_sync_delete"=0', [], _.bind(_defaultSelectInsert, ctx), grouper.err, null, true);
            } else {//Special config
                if (conf.skip) {//Skip this table
                    continue;
                };
                if (conf.limit>0) {//Split results
                    ctx.offset = 0;
                    grouper.count++;
                    //log('First', id, conf.limit, ctx.offset);
                    this.exec('select * from "'+id+'" where "_sync_delete"=0 order by "id" limit '+conf.limit, [], _.bind(_defaultSelectInsert, ctx), grouper.err, null, true);
                    continue;
                };
                if (conf.modify) {//Modify query before exec
                    var res = conf.modify([]);
                    if (res && res.length>0) {//Have modified queries
                        for (var j = 0; j < res.length; j++) {//
                            grouper.count++;
                            var _ctx = _.clone(ctx);
                            _ctx.table = res[j].table || id;
                            //log('Exec', res[j].query, _ctx.table, res[j].params[0]);
                            this.exec(res[j].query, res[j].params || [], _.bind(_defaultSelectInsert, _ctx), grouper.err, null, true);
                        };
                    };//Else - skip
                };
            };
        };
    }, this));
    for (var id in this.syncs) {//Make remove
        this.copyToDB.exec('delete from "'+id+'"', [], removes.ok, removes.err, null, true);
    };
    //this.copyToDB.exec('delete from _sync_deletes', [], removes.ok, removes.err);
};

Database.prototype.compact = function(config, handler) {//Removes all deleted items as well as other app defined
    var conf = config || [];
    var _tables = _.keys(this.syncs);
    var removes = new AsyncGrouper(_tables.length+conf.length, _.bind(function(gr) {//Removes done
        var err = gr.findError();
        if (err) {
            return handler(null, err);
        };
        handler(this);
    }, this));
    for (var i = 0; i < _tables.length; i++) {//
        this.exec('delete from "'+_tables[i]+'" where "_sync_delete">0', [], removes.ok, removes.err);
    };
    for (var i = 0; i < conf.length; i++) {//Run custom query
        this.exec(conf[i], [], removes.ok, removes.err);
    };
};

Database.prototype.cleanup = function(config, ok, err) {//Runs custom cleanup queries (remove completed etc.)
    var conf = config || [];
    var removes = new AsyncGrouper(conf.length, _.bind(function(gr) {//Removes done
        for (var i = 0; i < gr.count; i++) {//Check statuses
            if (!gr.statuses[i]) {//Insert failed
                //log('Copy failed', i, gr.results[i][0]);
                if (this.err) {//Report error
                    this.err('Cleanup failed: '+gr.results[i][0]);
                };
                return false;
            };
        };
        if (this.ok) {//Report success
            this.ok();
        };
    }, {ok: ok, err: err}));
    for (var i = 0; i < conf.length; i++) {//Run custom query
        this.exec(conf[i], [], removes.ok, removes.err);
    };
};

var createDefaultDBConfiguration = function(name, storage, sync_url, sync_key, configDB, handler) {//
    var jsonHelper = new JSONProxy({
        url: sync_url,
        key: sync_key,
        prefix: name
    });
    var client = storage.getString('client_name');
    if (!client) {
        client = guidGen(2);
        storage.setString('client_name', client);
    };
    log('Client:', client);
    var syncManager = new DBSync({
        local: {
            id: 'local',
            sync: 'true',
            storage: storage,
            name: ':'+name,
        },
        remote: {
            id: 'remote',
            sync: 'true',
            storage: storage,
            helper: jsonHelper,
        },
        configDB: configDB,
        client: client
    });
    syncManager.open(function(db, err) {//local DB opened
        if (db) {//
            handler(syncManager);
        } else {//Error
            _showError('Error opening DB: '+err);
        };
    });
};

var DBSync = function(config) {//New DB sync class
    this.configs = [config.local, config.remote];
    this.client = config.client;
    this.configDB = config.configDB;
    for (var i = 0; i < this.configs.length; i++) {
        this.configs[i].sync = true;
        this.configs[i].client = this.client;
    };
    this.dbs = [null, null];
};

DBSync.prototype._open = function(index, handler) {//
    if (this.dbs[index]) {
        handler(this.dbs[index]);
        return;
    };
    var db = new Database(this.configs[index]);
    this.configDB(db, index);
    db.open(_.bind(function() {//
        this.dbs[index] = db;
        handler(db);
    }, this), _.bind(function(err) {//
        handler(null, err);
    }, this));
};

DBSync.prototype.open = function(handler) {//Open DB
    this._open(0, handler);
};

DBSync.prototype.getSyncData = function(index, ids, handler) {//Collects sync data
    this._open(index, _.bind(function(db, err) {
        if (!db) {
            return handler(null, err);
        };
        var tables = _.keys(ids);
        var queries = [];
        for (var i = 0; i < tables.length; i++) {
            var fnames = [];
            var table = db.tables[tables[i]];
            var names = _.keys(table);
            for (var j = 0; j < names.length; j++) {
                if (table[names[j]].local) {//Skip
                    continue;
                };
                fnames.push(names[j]);
            };
            var query = 'select "'+fnames.join('", "')+'" from "'+tables[i]+'" where (("_sync_date_modified">=? and "id">?) or "_sync_date_modified">?) and "_sync_client"'+(index == 0? '=': '<>')+'? order by "_sync_date_modified", "id"';
            if (db.limits[tables[i]]>0) {//Add limit
                query += ' limit '+db.limits[tables[i]];
            };
            //log('Select', tables[i], ids[tables[i]], query, index, this.client);
            queries.push({
                type: 'select',
                query: query,
                values: [ids[tables[i]]._sync_date_modified, ids[tables[i]].id, ids[tables[i]]._sync_date_modified, this.client]
            });
        };
        db.batch(queries, _.bind(function(arr, err) {//Got results
            if (!arr) {//Invalid request
                handler(null, err);
            } else {//Prepare result
                var result = [];
                //log('After selects arr', arr.length, index);
                for (var i = 0; i < arr.length; i++) {
                    var data = arr[i];
                    //log('data', i, data, tables[i], data.length);
                    if (data.length>0) {//Put this
                        result.push({table: tables[i], data: data, last: data[data.length-1]._sync_date_modified, last_id: data[data.length-1].id});
                    };
                };
                handler(result);
            };
        }, this))
    }, this));
};

DBSync.prototype._sync = function(from, to, handler) {//Sends data from from to to
    this._open(from, _.bind(function(db, err) {//Opened
        if (!db) {
            return handler(null, err);
        };
        this._open(to, _.bind(function(dbto, err) {//Opened second
            if (!dbto) {
                return handler(null, err);
            };
            var tables = _.keys(db.syncs);
            var startids = {};
            var maxID = 0;
            var startID = db.storage.getInt('last_'+db.config.id, 0);
            var sqlMade = 0;
            for (var i = 0; i < tables.length; i++) {
                //log('Starting', tables[i], startID, from, to);
                startids[tables[i]] = {_sync_date_modified: startID, id: 0};
            };
            var nextPiece = _.bind(function(arr, err) {//Next piece
                if (!arr) {//Error
                    //log('nextPiece error');
                    return handler(null, err);
                };
                if (arr.length == 0) {//Finished
                    //log('nextPiece - 0', maxID, from, to);
                    if (maxID>0) {//Save
                        db.storage.setInt('last_'+db.config.id, maxID);
                    };
                    return handler(sqlMade);
                };
                var ids = {};//Next starts
                //log('nextPiece', arr.length);
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i].last>maxID) {
                        maxID = arr[i].last+1;
                    };
                    ids[arr[i].table] = {_sync_date_modified: arr[i].last, id: arr[i].last_id};
                    //log('arr', i, arr[i].table, arr[i].last, arr[i].data.length);
                };
                var configs = this.selectToInsertDelete(arr);
                //log('Queries ready to insert/update:', from, to, configs.length, _.keys(ids));
                sqlMade += configs.length;
                dbto.batch(configs, _.bind(function(res, err) {//Data sent
                    if (!res) {//Error
                        //log('Batch failed', err);
                        return handler(null, err);
                    };
                    //log('Batch done', res.length);
                    this.getSyncData(from, ids, nextPiece);
                }, this))
            }, this);
            this.getSyncData(from, startids, nextPiece);
        }, this));
    }, this))
};

DBSync.prototype.onSyncStart = function() {};
DBSync.prototype.onSyncFinish = function() {};

DBSync.prototype.sync = function(handler) {//
    this.onSyncStart();
    this._sync(0, 1, _.bind(function(to, err) {//from - to
        //log('local->remote', to, err);
        if (to>=0 && !err) {
            this._sync(1, 0, _.bind(function(from, err) {//
                //log('remote->local', to, err);
                if (from>=0 && !err) {//Done
                    var value = {to: to, from: from};
                    this.onSyncFinish(value);
                    handler(value);
                } else {
                    this.onSyncFinish(null, err);
                    handler(null, err);
                };
            }, this))
        } else {
            this.onSyncFinish(null, err);
            handler(null, err);
        };
    }, this))
};

DBSync.prototype.query = function(config) {//Runs local query
    if (!this.dbs[0]) {//No local DB
        handler(null, 'DB not opened');
    };
    this.dbs[0].query(config);
};

DBSync.prototype.batch = function(config, handler) {//Runs local query
    if (!this.dbs[0]) {//No local DB
        handler(null, 'DB not opened');
    };
    this.dbs[0].batch(config, handler);
};

DBSync.prototype.selectToInsertDelete = function(arr) {//Converts array after selects to array for batch insert/update
    if (!arr) {
        return [];
    };
    var result = [];
    for (var i = 0; i < arr.length; i++) {
        var table = arr[i].table;
        var data = arr[i].data;
        for (var j = 0; j < data.length; j++) {
            if (data[j]._sync_delete>0) {//Make update
                //log('Removing from', table, 'id', data[j].id);
                result.push({
                    type: 'remove',
                    table: table,
                    values: [data[j].id],
                    client: data[j]._sync_client,
                    where: 'id=?'
                });
            } else {//Insert/update
                //log('Insert/update', table, 'id', data[j].id, 'data', data[j]);
                result.push({
                    type: 'insert',
                    table: table,
                    fields: _.keys(data[j]),
                    client: data[j]._sync_client,
                    values: _.values(data[j])
                });
            };
        };
    };
    return result;
};

DBSync.prototype.reset = function(handler) {//Resets local DB. drops all tables, run init again
    this._open(0, _.bind(function(db) {//
        db.reset(_.bind(function(db, err) {//
            if (!db) {
                return handler(null, err);
            };
            if (db.storage) {//last ids
                db.storage.clear('last_'+this.configs[0].id);
                db.storage.clear('last_'+this.configs[1].id);
                db.storage.clear('client_name');
            };
            this.dbs = null;
            return handler(this);
        }, this));
    }, this));
};

