var DBConfig = function(config) {//DB configuration page
    this.config = config || {};
    this.db = null;
    this._xmppHelper = null;
    $(document.body).append($('<div id="indicator"/>').hide().text(' '));
    this.storage = this.config.storage || window.storage || null;
    this.dbConfig = this.config.dbConfig || window.dbConfig || [];
    if (this.dbConfig.length == 0 && this.storage) {//Try to open from storage
        this.dbConfig = this.storage.getObject('dbs', []);
    };
    if (this.config.appConfig) {//Have appConfig
        this.appConfig = this.storage.getObject('app_config', {});
    };
    if (this.dbConfig.length == 0) {//Empty db config
        this.dbConfig.push({id: this.uid(), name: 'Default', location: ':default'});
        this.storage.setObject('dbs', this.dbConfig);
    };
    this.icons = this.config.icons || window.icons || {};
    this.manager = this.config.manager || window.manager;

    this.api = new EventEmitter();

    this.panel = new Panel();
    this.topMenu = new Buttons({
        maxElements: 3,
        root: this.panel.element
    });
    if (this.config.goBack) {//Add go back function
        this.topMenu.addButton({
            caption: 'Back',
            handler: _.bind(function() {//Go back
                this.manager.goBack(this.panel);
            }, this)
        });
    };
    if (this.config.appConfig) {//Add config button
        var _menu = new Buttons({
            maxElements: 1,
            root: this.panel.element
        });
        _menu.addButton({
            caption: 'Application config',
            handler: _.bind(function() {//
                this.editAppConfig();
            }, this),
        });
    };
    if (this.config.db) {//Create DB controls
        $('<div/>').addClass('panel_title').appendTo(this.panel.element).text('Databases:');
        this.dbMenu = new Buttons({
            maxElements: 2,
            root: this.panel.element
        });
        this.dbMenu.addButton({
            caption: (this.icons.db_local || '')+'Add local',
            className: 'button_add',
            handler: _.bind(function() {//Add local DB
                this.dbConfig.push({id: this.uid(), name: 'Default', location: ':tasks'});
                if (this.storage) {
                    storage.setObject('dbs', this.dbConfig);
                };
                this.panel.onSwitch();
            }, this)
        });
        if (CURRENT_PLATFORM == PLATFORM_AIR || CURRENT_PLATFORM == PLATFORM_WEB || CURRENT_PLATFORM_MOBILE) {//Only for air and phonegap
            this.dbMenu.addButton({
                caption: (this.icons.db_xmpp || '')+'Add XMPP',
                className: 'button_add',
                handler: _.bind(function() {//Add local DB
                    this.dbConfig.push({id: this.uid(), name: 'XMPP DB', xmpp: true});
                    if (this.storage) {
                        this.storage.setObject('dbs', this.dbConfig);
                    };
                    this.panel.onSwitch();
                }, this)
            });
        };
        this.buttons = new Buttons({
            maxElements: 2,
            weights: [70, 30],
            safe: true,
            root: this.panel.element
        });
        //DB API
        this.api.on('copy_db', _.bind(function(evt) {//Do copy DB
            var object = evt.object || {};
            //log('copy_db API call');
            if (!object.from || !object.to) {//No required params
                log('No enough params');
                return false;
            };
            var fromIndex = -1;
            var toIndex = -1;
            for (var i = 0; i < this.dbConfig.length; i++) {//Search indexes
                if (this.dbConfig[i].name && object.from.toLowerCase() == this.dbConfig[i].name.toLowerCase()) {//Found
                    fromIndex = i;
                };
                if (this.dbConfig[i].name && object.to.toLowerCase() == this.dbConfig[i].name.toLowerCase()) {//Found
                    toIndex = i;
                };
            };
            if (fromIndex == -1 || toIndex == -1 || fromIndex == toIndex) {//Invalid params
                log('Invalid data');
                return false;
            };
            this.copyMerge('copy', fromIndex, toIndex, object.from_password, object.to_password);
        }, this));
        this.api.on('cleanup_db', _.bind(function(evt) {//Do cleanup
            if (!this.currentDB) {//No DB loaded
                return false;
            };
            this.db.cleanup(this.config.cleanup, _.bind(function() {//Done
                _showInfo('Cleanup done');
            }, this), _defaultDBError);
        }, this));
        this.api.on('compact_db', _.bind(function(evt) {//Do compact
            if (!this.currentDB) {//No DB loaded
                return false;
            };
            this.db.compact(this.config.compact, _.bind(function() {//Done
                _showInfo('Compact done');
            }, this), _defaultDBError);
        }, this));
    };
    if (this.config.api) {//Add API controls
        $('<div/>').addClass('panel_title').appendTo(this.panel.element).text('API connections:');
        this.apiMenu = new Buttons({
            maxElements: 2,
            root: this.panel.element
        });
        if (CURRENT_PLATFORM == PLATFORM_AIR) {//Only for AIR
            this.apiMenu.addButton({
                caption: (this.icons.api_config || '')+'Access',
                handler: _.bind(function() {//Add local DB
                    this.editAPIConfig();
                }, this)
            });
        };
        if (CURRENT_PLATFORM == PLATFORM_WEB && window.chrome) {//Chrome extension
            log('Adding message listener');
            chrome.extension.onRequestExternal.addListener(_.bind(function(req, sender, resp) {//
                //log('Message from API', req);
                var evt = {};
                evt.operation = req.method || 'POST';
                evt.object = req.object || {};
                this.api.emit(req.operation, evt);
                errorString = evt.error;
                resp({error: errorString, output: evt.output});
            }, this));

        };
        this.apiMenu.addButton({
            caption: (this.icons.api_add || '')+'Add point',
            className: 'button_add',
            handler: _.bind(function() {//Add new point
                var points = this.getPoints();
                points.push({name: 'point', port: 0, host: '127.0.0.1'});
                this.storage.setObject('api_points', points);
                this.panel.onSwitch();
            }, this)
        });
        this.apiButtons = new Buttons({
            maxElements: 1,
            safe: true,
            root: this.panel.element
        });
        this.openAPIPort();
        _appEvents.on('invoke', _.bind(function(e) {//App re-invoked
            if (e.args[0] != '-api') {//Not API
                return false;
            };
            var api = e.args[1];
            if (!api) {//No API
                return false;
            };
            var op = null;
            var startWith = 2;
            if (e.args[2] == '-method') {//Operation
                op = e.args[3];
                startWith = 4;
            };
            if (!op) {//Default - post
                op = 'post';
            };
            var obj = {};
            for (var i = startWith; i < e.args.length; i+=2) {//Copy arguments
                var name = e.args[i].substr(1);
                var val = e.args[i+1] || null;
                if (val && _.startsWith(val, '-')) {//Another param
                    i--;
                    val = null;
                };
                //log('Params['+api+']:', name, val);
                obj[name] = val;
            };
            var evt = {};
            evt.operation = op;
            evt.object = obj;
            this.api.emit(api, evt);
            return true;
        }, this))
    };
    this.panel.onSwitch = _.bind(function() {//Load databases
        if (this.config.db) {//Reload DB
            this.buttons.clear();
            for (var i = 0; i < this.dbConfig.length; i++) {//Show button
                var btn = {
caption: (this.currentDB && this.dbConfig[i].id == this.currentDB.id? (this.icons.menu_selected || '->'): '')+(this.dbConfig[i].xmpp? (this.icons.db_xmpp || ''): (this.icons.db_local || ''))+this.dbConfig[i].name,
                    className: 'button_left',
                    handler: _.bind(function(e, btn) {//Load selected DB
                        this._loadDB(btn.uid);
                    }, this),
                    uid: this.dbConfig[i].id,
                    index: i
                };
                this.buttons.addButton(btn);
                btn = {
                    caption: (this.icons.edit || '')+'Edit',
                    handler: _.bind(function(e, btn) {//editConnection
                        this.editConnection(btn.index);
                    }, this),
                    index: i
                };
                this.buttons.addButton(btn);
            };
        };
        if (this.config.api) {//Reload points
            this.apiButtons.clear();
            var points = this.getPoints();
            for (var i = 0; i < points.length; i++) {//Add buttons
                var btn = {
                    caption: (this.icons.edit || '')+points[i].name+(points[i].port? '': '(disabled)'),
                    className: 'button_left',
                    handler: _.bind(function(e, btn) {//Edit point
                        this.editPoint(btn.index);
                    }, this),
                    index: i
                };
                this.apiButtons.addButton(btn);
            };
        };
    }, this);
};

DBConfig.prototype.openAPIPort = function() {//(Re)opens port and listens for HTTP connection
    if (this.serverSocket) {//Close first
        try {
            this.serverSocket.close();

        } catch (e) {//Close error
        }
        this.serverSocket = null;
    };
    var config = this.storage.getObject('api_config', {});
    if (config.port>0 && CURRENT_PLATFORM == PLATFORM_AIR) {//Open port
        var port = new air.ServerSocket();
        try {
            port.bind(config.port);
            var hosts = ['127.0.0.1'];//By default local connections are allowed
            if (config.hosts && config.hosts.length>0) {//Parse
                hosts = config.hosts.split(',');
            };
            port.addEventListener('connect', _.bind(function(e) {//Incoming connection
                var socket = e.socket;
                //log('Connected from ', socket.remoteAddress);
                var remoteOK = false;
                for (var i = 0; i < hosts.length; i++) {//Check hosts
                    if (_.startsWith(socket.remoteAddress, hosts[i])) {//OK
                        remoteOK = true;
                        break;
                    };
                };
                if (!remoteOK) {//Invalid host
                    log('Attempting to connect from invalid host: '+socket.remoteAddress);
                    _showInfo('Connect from invalid host: '+socket.remoteAddress);
                    socket.close();
                    return false;
                };
                var operation = null;
                var path = null;
                var buffer = '';
                socket.addEventListener('socketData', _.bind(function(e) {//Data received
                    try {
                        var lineCount = 0;
                        buffer += socket.readUTFBytes(socket.bytesAvailable);
                        var lines = buffer.split('\n');
                        //log('Lines:', lines.length, e.bytesLoaded, buffer.length);
                        while (lineCount<lines.length) {//Read data line by line
                            var line = _.trim(lines[lineCount]);
                            //log('Line:', lineCount, line);
                            if (lineCount == 0) {//First line - parse
                                var arr = line.split(' ');
                                if (arr.length == 3) {//POST /xxx HTTP/1.0
                                    operation = arr[0].toLowerCase();
                                    path = arr[1].substr(1);
                                };
                            };
                            if (line == '') {//Empty line - start reading object
                                var object = '';
                                while (lineCount<lines.length) {//Read and add to object
                                    var line = _.trim(lines[lineCount]);
                                    if (line) {//
                                        object += line+'\n';
                                    };
                                    lineCount++;
                                };
                                if (object) {//
                                    var errorString = null;
                                    //log('operation:', operation, 'path:', path);
                                    if (!operation || !path) {//Terminate conn
                                        log('No operation and/or path');
                                        socket.close();
                                        return false;
                                    };
                                    var evt = {};
                                    evt.operation = operation;
                                    try {
                                        evt.object = JSON.parse(object);
                                    } catch (e) {//JSON error
                                        log('JSON:', e);
                                        log('Buffer', buffer, '['+object+']', object.length);
                                        errorString = 'JSON error';
                                    }
                                    if (!errorString) {//OK
                                        this.api.emit(path, evt);
                                        errorString = evt.error;
                                    };
                                    if (errorString) {//Replace output
                                        evt.output = {error: errorString};
                                    };
                                    socket.writeUTFBytes('HTTP/1.1 200 OK\r\n');
                                    socket.writeUTFBytes('Date: '+(new Date())+'\r\nMIME-Version: 1.0\r\nServer: XMPP API server\r\nConnection: close\r\nContent-Type: application/javascript; charset=utf-8\r\n\r\n');
                                    if (evt.output) {//Serialize and put to socket
                                        socket.writeUTFBytes(JSON.stringify(evt.output));
                                    };
                                    socket.flush();
                                    socket.close();
                                };
                            };
                            lineCount++;
                        };
                    } catch (e) {//Socket error
                        log('Socket error:', e);
                        socket.close();
                    }
                }, this));
            }, this));
            port.listen();
            this.serverSocket = port;
            _showInfo('API port opened');
        } catch (e) {//Open error
            _showError('Error opening API port: '+e);
        }
    } else {//Show info
        _showInfo("API port disabled");
    };
};

DBConfig.prototype.callAPI = function(config) {//Call remote API
    config = config || {};
    if (!config.ok) {//Add empty OK handler
        config.ok = function() {};
    };
    if (!config.err) {//Add default err handler
        config.err = function(error) {//Show error
            _showInfo('API error: '+error);
        }
    };
    var points = this.getPoints();
    var point = null;
    for (var i = 0; i < points.length; i++) {//Search point
        if (points[i].name == config.point) {//Found
            point = points[i];
            break;
        };
    };
    if (!point) {//No such point
        config.err('No such point configured: '+config.point);
        return false;
    };
    if (point.port>0) {//OK
        $.ajax({
            data: config.object? JSON.stringify(config.object): null,
            dataType: 'json',
            cache: false,
            type: config.operation? config.operation.toUpperCase(): 'POST',
            url: 'http://'+(point.host? point.host: '127.0.0.1')+':'+point.port+'/'+(config.method || config.point),
            context: config,
            success: function(data) {//Executed
                if (data && data.error) {//Report error
                    this.err(data.error);
                };
                this.ok(data || {});
            },
            error: function(xhr, st) {//HTTP error
                log('HTTP error', st, xhr.status, xhr.statusText);
                this.err(st || 'Unknown API error');
            }
        });
    } else {//Error
        config.err('API point disabled: '+config.point);
        return false;
    };
};

DBConfig.prototype.getPoints = function() {//Returns points config
    return this.storage.getObject('api_points', []);
};

DBConfig.prototype.editAPIConfig = function() {//Shows API config page
    _createEsentials(this, 'API access config:', 2, 'apiPanel', 'apiConfigMenu');
    _goBackFactory(this.apiConfigMenu, this.apiPanel, this.icons.back);
    this.apiConfigMenu.addButton({
        caption: (this.icons.save || '')+'Save',
        handler: _.bind(function() {//Save and go back
            this.storage.setObject('api_config', this.apiForm.saveForm());
            this.manager.goBack(this.pointPanel);
            this.openAPIPort();
        }, this)
    });
    this.apiForm = new AutoForm(this.apiPanel.element, {
        port: {label: 'Port:'},
        hosts: {label: 'Hosts:'}
    }, 'api', this.storage.getObject('api_config', {}));
    this.manager.show(this.apiPanel, this.panel);
};

DBConfig.prototype.editAppConfig = function() {//Shows App config page
    _createEsentials(this, 'Application config:', 2, 'appPanel', 'appConfigMenu');
    _goBackFactory(this.appConfigMenu, this.appPanel, this.icons.back);
    this.appConfigMenu.addButton({
        caption: (this.icons.save || '')+'Save',
        handler: _.bind(function() {//Save and go back
            this.appConfig = this.appForm.saveForm(this.appConfig);
            if (this._appConfigChanged) {//Handler
                this._appConfigChanged(this.appConfig);
            };
            this.storage.setObject('app_config', this.appConfig);
            this.manager.goBack(this.pointPanel);
        }, this)
    });
    this.appForm = new AutoForm(this.appPanel.element, this.config.appConfig, 'app', this.appConfig);
    this.manager.show(this.appPanel, this.panel);
};

DBConfig.prototype.editPoint = function(index) {//Shows point edit dialog
    _createEsentials(this, 'API point config:', 3, 'pointPanel', 'pointMenu');
    _goBackFactory(this.pointMenu, this.pointPanel, this.icons.back);
    this.pointMenu.addButton({
        caption: (this.icons.save || '')+'Save',
        handler: _.bind(function() {//Save and go back
            var points = this.getPoints();
            points[index] = this.pointForm.saveForm();
            this.storage.setObject('api_points', points);
            this.manager.goBack(this.pointPanel);
        }, this)
    });
    this.pointMenu.addButton({
        caption: (this.icons.remove || '')+'Remove',
        handler: _.bind(function() {//Remove and go back
            var points = this.getPoints();
            points.splice(index, 1);
            this.storage.setObject('api_points', points);
            this.manager.goBack(this.pointPanel);
        }, this)
    });
    var value = this.getPoints()[index];
    this.pointForm = new AutoForm(this.pointPanel.element, {
        name: {label: 'Name:'},
        port: {label: 'Port:'},
        host: {label: 'Host:'}
    }, 'point', value);
    this.manager.show(this.pointPanel, this.panel);
};


DBConfig.prototype.uid = function() {//Generates random ID
    return Math.random().toString().substr(2);
};

DBConfig.prototype.openDefault = function() {//Open default DB
    if (this.storage) {
        var defaultDB = storage.getString('db_index', 'No ID');
        this._loadDB(defaultDB);
    };
};

DBConfig.prototype.cleanupDB = function() {//Cleanups DB
    _showQuestion('Are you sure want to cleanup DB? '+(this.config.cleanupInfo || ''), _.bind(function(index) {//Do cleanup
        if (index == 0) {//Yes
            _showInfo('Please wait...');
            this.db.cleanup(this.config.cleanup, _.bind(function() {//Done
                _showInfo('Cleanup done');
            }, this), _defaultDBError);
        };
    }, this))
};

DBConfig.prototype.compactDB = function() {//Compacts DB
    _showQuestion('Are you sure want to compact DB? '+(this.config.compactInfo || ''), _.bind(function(index) {//Do compact
        if (index == 0) {//Yes
            _showInfo('Please wait...');
            this.db.compact(this.config.compact, _.bind(function() {//Done
                _showInfo('Compact operation done');
            }, this), _defaultDBError);
        };
    }, this))
};

DBConfig.prototype.showStatistics = function() {//Calculates stat about DB
    _showInfo('Please wait...');
    this.db.getStatistics(_.bind(function(stat) {//Got stat
        _showInfo('Stat: inserted: '+stat.ins+', updated: '+stat.upd+', removed: '+stat.del, 10000);
    }, this), _defaultDBError);
};

DBConfig.prototype.editConnection = function(index) {//Edits DB config
    this.selectedIndex = index;
    this.selected = this.dbConfig[index];
    this.selectedUID = this.selected.id || this.uid();
    this.editor = new Panel('Connection: '+this.selected.name);
    this.topMenu = new Buttons({
        maxElements: 2,
        root: this.editor.element
    });
    this.topMenu.addButton({
        caption: (this.icons.back || '')+'Back',
        handler: _.bind(function() {//Go back
            this.manager.goBack(this.editor);
        }, this)
    });
    this.topMenu.addButton({
        caption: (this.icons.save || '')+'Save',
        handler: _.bind(function() {//Save & Go back
            var form = this.form.saveForm();
            if (!form.name) {//Name is empty
                _showError('Please enter the name');
                return;
            };
            if (this.selected.xmpp && !form.jid) {//No jid in XMPP connection
                _showError('Please enter the JID');
                return;
            };
            if (this.selected.xmpp && !form.service) {//No service in XMPP connection
                _showError('Please enter the service JID');
                return;
            };
            form.xmpp = this.selected.xmpp;
            form.id = this.selectedUID;
            this.dbConfig[this.selectedIndex] = form;
            if (form.by_default && this.storage) {//Set this DB as default
                storage.setString('db_index', this.selectedUID);
            };
            if (this.storage) {
                storage.setObject('dbs', this.dbConfig);
            };
            this.manager.goBack(this.editor);
        }, this)
    });
    this.topMenu.addButton({
        caption: (this.icons.remove || '')+'Remove',
        handler: _.bind(function() {//Save & Go back
            this.dbConfig.splice(this.selectedIndex, 1);
            if (this.storage) {
                storage.setObject('dbs', this.dbConfig);
            };
            this.manager.goBack(this.editor);
        }, this)
    });
    this.topMenu.addButton({
        caption: (this.icons.more || '')+'More...',
        handler: _.bind(function() {//Show popup
            var items = [{caption: 'Copy to...'}, {caption: 'Apply changes to...'}];
            if (this.currentDB && this.selected.id == this.currentDB.id) {//Only on selected
                items.push({caption: 'Show statistics'}, {caption: 'Compact DB'});
                if (this.config.cleanup && this.config.cleanup.length>0) {//Have cleanup queries
                    items.push({caption: 'Cleanup DB'});
                };
                if (this.currentDB.xmpp) {//Reset cache
                    items.push({
                        caption: 'Reset cache',
                        handler: _.bind(function() {//Do reset
                            _showQuestion('Are you sure want to reset DB cache?', _.bind(function(index) {//Do cleanup
                                if (index == 0) {//Yes
                                    _showInfo('Please wait...');
                                    this._xmppHelper.resetCache(_.bind(function() {//Done
                                        this._loadDB(this.selected.id);
                                    }, this), _defaultDBError);
                                };
                            }, this))
                        }, this)
                    });
                };
            };
            new PopupMenu({
                panel: this.editor,
                items: items,
                handler: _.bind(function(item, index) {//Menu item selected
                    //log('Selected:', index);
                    if (index == 0) {//Copy
                        this.selectDatabase('copy', 'Are sure want to copy data');
                    };
                    if (index == 1) {//Merge
                        this.selectDatabase('merge', 'Are sure want to apply changes');
                    };
                    if (index == 2) {//Show stat
                        this.showStatistics();
                    };
                    if (index == 3) {//Compact
                        this.compactDB();
                    };
                    if (index == 4) {//Cleanup
                        this.cleanupDB();
                    };
                    return true;
                }, this)
            });
        }, this)
    });
    var formConfig = {
        name: {label: 'Name:', value: this.selected.name},
    };
    if (this.selected.xmpp) {//XMPP connection
        formConfig.connection = {label: 'Connection:', value: this.selected.connection};
        formConfig.jid = {label: 'JID:', value: this.selected.jid};
        formConfig.password = {label: 'Password:', value: this.selected.password, type: 'password'};
        formConfig.service = {label: 'Service:', value: this.selected.service};
        formConfig.proxy = {label: 'Proxy:', value: this.selected.proxy};
        formConfig.ping = {label: 'Ping other side', value: this.selected.ping, type: 'checkbox'};
        formConfig.timeout = {label: 'Timeout:', value: this.selected.timeout};
        formConfig.autooff = {label: 'Auto disconnect timeout:', value: this.selected.autooff};
    } else {//Local connection
        formConfig.location = {label: 'DB location:', value: this.selected.location};
        formConfig.use_password = {label: 'Encrypt (if supported):', value: this.selected.use_password, type: 'checkbox'};
        formConfig.password = {label: 'Password:', value: this.selected.password, type: 'password'};
    };
    if (this.config.dbForm) {//Append add. form fields
        for (var id in this.config.dbForm) {//Append
            var obj = this.config.dbForm[id];
            obj.value = this.selected[id];
            formConfig[id] = obj;
        };
    };
    formConfig.by_default = {label: 'Open by default', value: false, type: 'checkbox'};
    this.form = new AutoForm(this.editor.element, formConfig, 'db');
    this.manager.show(this.editor, this.panel);
};

DBConfig.prototype.copyMerge = function(mode, indexFrom, indexTo, passwordFrom, passwordTo) {//Do copy or merge
    if (this.dbConfig[indexFrom].xmpp && this.dbConfig[indexTo].xmpp) {//Not possible to use 2 xmpp DBs
        _showError('Can\'t run operation on two XMPP databases. Please select one local DB');
        return;
    };
    var opens = new AsyncGrouper(2, _.bind(function(gr) {//Open complete
        if (!gr.statuses[0]) {//First open failed
            _defaultDBError(gr.results[0][0]);
            return;
        };
        if (!gr.statuses[1]) {//Second open failed
            _defaultDBError(gr.results[1][0]);
            return;
        };
        var from = gr.from;
        var to = gr.to;
        if (mode == 'copy') {//Do copy
            _showInfo('Starting copy routine', 0);
            from.copyTo(to, {
                ok: _.bind(function(count) {//Copy done
                    _showInfo('Copy done. '+count+' steps made');
                    this.manager.goBack(this.selectDB);
                    this.openDefault();
                }, this),
                error: _.bind(function(err) {//Copy failed
                    _defaultDBError(err);
                    this.manager.goBack(this.selectDB);
                    _showInfo('Copy failed');
                    this.openDefault();
                }, this),
                tables: this.config.tables
            });
        };
        if (mode == 'merge') {//Do copy
            _showInfo('Starting merge routine', 0);
            from.applyTo(to, {
                ok: _.bind(function(count) {//Merge done
                    _showInfo('Merge done. '+count+' steps made');
                    this.manager.goBack(this.selectDB);
                    this.openDefault();
                }, this),
                error: _.bind(function(err) {//Merge failed
                    _defaultDBError(err);
                    this.manager.goBack(this.selectDB);
                    this.openDefault();
                }, this)
            });
        };
    }, this));
    _showInfo('Opening both databases...');
    var dbconfig = {
        sync: true
    };
    var conf = _.clone(this.dbConfig[indexFrom]);
    if (passwordFrom) {//Have password
        conf.password = passwordFrom;
    };
    this._initXMPPHandler(conf, dbconfig);
    var db = new Database(dbconfig);
    this._fillDB(db);
    opens.from = db;
    db.open(opens.ok, opens.err);
    dbconfig = {
        sync: true
    };
    conf = _.clone(this.dbConfig[indexTo]);
    if (passwordTo) {//Have password
        conf.password = passwordTo;
    };
    this._initXMPPHandler(conf, dbconfig);
    db = new Database(dbconfig);
    this._fillDB(db);
    opens.to = db;
    db.open(opens.ok, opens.err);
};

DBConfig.prototype.selectDatabase = function(mode, question) {//Shows second DB select panel
    _createEsentials(this, 'Select target:', 1, 'selectDB', 'selectDBMenu');
    _goBackFactory(this.selectDBMenu, this.selectDB, this.icons.back);
    this.selectDBButtons = new Buttons({
        root: this.selectDB.element,
        maxElements: 1,
        safe: true
    });
    for (var i = 0; i < this.dbConfig.length; i++) {//Add buttons
        if (i == this.selectedIndex) {//Skip selected DB
            continue;
        };
        this.selectDBButtons.addButton({
            caption: (this.dbConfig[i].xmpp? (this.icons.db_xmpp || ''): (this.icons.db_local || ''))+this.dbConfig[i].name,
            className: 'button_left',
            name: this.dbConfig[i].name,
            index: i,
            handler: _.bind(function(e, btn) {//DB selected
                _showQuestion(question+' from "'+this.selected.name+'" to "'+btn.name+'"?', _.bind(function(index) {//Answer
                    if (index == 0) {//Yes
                        this.copyMerge(mode, this.selectedIndex, btn.index);
                    };
                }, this))
            }, this)
        });
    };
    this.manager.show(this.selectDB, this.editor);
};

DBConfig.prototype.show = function() {
    this.manager.element.show();
};

DBConfig.prototype._beforeLoadDB = function() {//Empty by default
};

DBConfig.prototype._onDBStart = function() {//
};

DBConfig.prototype._onDBStop = function(object) {//
};

DBConfig.prototype._initXMPPHandler = function(obj, dbconfig) {//Resets XMPPHandler
    if (this._xmppHelper) {//Stop current XMPP connection
        this._xmppHelper.stop();
        this._xmppHelper = null;
    };
    $('#indicator').hide();
    dbconfig.id = obj.id;
    if (obj.xmpp) {//XMPP connection used
        obj.statusHandler = this.config.xmppStatusHandler || null;
        obj.prefix = this.config.dbPrefix || null;
        this._xmppHelper = new XMPPDBHelper(obj, this);
        this._xmppHelper._onSyncDone = _.bind(function() {//Sync done
            log('_onSyncDone from XMPPDBHelper');
            this._onSyncDone();
        }, this);
        dbconfig.helper = this._xmppHelper;
        $('#indicator').show();
    } else {//Local connection
        dbconfig.name = obj.location;
        dbconfig.password = obj.password;
    };
};

DBConfig.prototype._loadDB = function(index) {//Loads selected DB
    var obj = null;
    log('Opening', index);
    for (var i = 0; i < this.dbConfig.length; i++) {//Look for config by ID
        if (this.dbConfig[i].id == index) {//Found
            obj = _.clone(this.dbConfig[i]);
            break;
        };
    };
    if (!obj) {//Invalid index
        this._onDBOpenFailed('Invalid DB');
        return;
    };
    if ((obj.use_password || obj.xmpp) && !obj.password) {//Ask for password
        obj.session_token = true;
        var wr = $('<div/>').addClass('input_wrap');
        var inp = $('<input type="password"/>').addClass('add_task').appendTo(wr);
        if (CURRENT_PLATFORM == PLATFORM_AIR) {//Activate win
            window.nativeWindow.activate();
        };
        var btns = _showQuestion('Enter the password for account "'+obj.name+'":', _.bind(function(index) {//Finished
            if (index == 1) {//Cancel
                return;
            };
            this.object.password = this.input.val();
            this.instance._doLoadDBWithPassword(this.object);
        }, {instance: this, input: inp, object: obj}), [{caption: 'Ok'}, {caption: 'Cancel'}], wr);
        inp.delay(100).focus().keydown(_.bind(function(e) {//Key pressed
            if (e.which == 13) {//Emulate Ok
                this.click(this.buttons[0]);
                return false;
            };
            if (e.which == 27) {//Emulate Cancel
                this.click(this.buttons[1]);
                return false;
            };
            return true;
        }, btns));
    } else {//Directly load DB
        this._doLoadDBWithPassword(obj);
    };
};

DBConfig.prototype._doLoadDBWithPassword = function(obj) {//Password is saved
    this.currentDB = obj;
    this._beforeLoadDB();
    var dbconfig = {
        sync: true
    };
    this._initXMPPHandler(obj, dbconfig);
    this.db = new Database(dbconfig);
    this._fillDB(this.db);
    this.db.on_start = this._onDBStart;
    this.db.on_end = this._onDBStop;
    this.db.open(_.bind(function() {//DB created
        log('db OK');
        this._onDBOpened();
        if (!this._xmppHelper) {//Local DB
            log('_onSyncDone from _doLoadDBWithPassword');
            this._onSyncDone();
        };
    }, this), _.bind(function(err) {//DB open failed
        _defaultDBError(err);
        this._onDBOpenFailed(err);
    }, this));
};

DBConfig.prototype._onDBOpened = function() {//
};

DBConfig.prototype._onDBOpenFailed = function() {//
};

DBConfig.prototype._fillDB = function(db) {//
};

DBConfig.prototype._onSyncDone = function(db) {//
};

DBConfig.prototype.parseCronString = function(str, dt) {//
    var _buildCronData = function(min, max, str) {//
        var res = [];
        if (str == '*') {
            str = '*/1';
        };
        if (_.startsWith(str, '*/')) {//Every...
            var delim = parseInt(str.substr(2)) || 99;
            //log('_buildCronData: */', delim);
            for (var i = min; i <= max; i++) {//Go
                if (i % delim == 0) {//OK
                    res.push(i);
                };
            };
        } else {//Parse by ,,
            var arr = str.split(',');
            //log('_buildCronData: ,,', arr.length);
            for (var i = 0; i < arr.length; i++) {
                if (arr[i].indexOf('-') != -1) {//Range
                    var start = parseInt(arr[i].substr(0, arr[i].indexOf('-')));
                    var end = parseInt(arr[i].substr(arr[i].indexOf('-')+1));
                    if (start>=min && end<=max) {//Range OK
                        for (var j = start; j <=end; j++) {
                            res.push(j);
                        };
                    };
                } else {//Just number
                    var num = parseInt(arr[i]);
                    if (num>=min && num<=max) {//Range OK
                        res.push(num);
                    };
                };
            };
        };
        return res;
    };
    if (!str) {
        str = '61 * * * *';
    };
    if (!dt) {
        dt = new Date();
    };
    var arr = str.split(' ');
    while (arr.length<5) {//Add stars
        arr.push('*');
    };
    var checks = [{val: dt.getMinutes(), min: 0, max: 59, str: arr[0]}, {val: dt.getHours(), min: 0, max: 23, str: arr[1]}, {val: dt.getDate(), min: 1, max: 31, str: arr[2]}, {val: dt.getMonth()+1, min: 1, max: 12, str: arr[3]}, {val: dt.getDay(), min: 0, max: 6, str: arr[4]}];
    for (var i = 0; i < checks.length; i++) {
        var ch = checks[i];
        var arr = _buildCronData(ch.min, ch.max, ch.str);
        var valFound = false;
        log('parseCronString', ch.min, ch.max, ch.val, ch.str, arr.length);
        for (var j = 0; j < arr.length; j++) {
            if (arr[j] == ch.val) {//Found
                valFound = true;
                break;
            };
        };
        if (!valFound) {
            return null;
        };
    };
    return true;
};
