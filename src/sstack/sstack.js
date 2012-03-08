var manager = null;
var layout = null;
var config = null;
var sheetWindows = {};
var db = null;

yepnope({
    load: ['lib/custom-web/cross-utils.js', 'lib/common-web/jquery-1.7.1.min.js', 'lib/common-web/underscore-min.js', 'lib/common-web/underscore.strings.js', 'lib/custom-web/date.js', 'lib/common-web/json2.js', 'lib/custom-web/layout.js', 'lib/custom-web/pending.js', 'lib/custom-web/calendar.js', 'lib/ui/ui.css', 'lib/ui/theme-default.css', 'lib/ui/ui.js', 'lima1/net.js', 'lima1/main.js'],
    complete: function () {
        yepnope([{
            load: ['lib/common-web/jquery.autogrow.js', 'lib/common-web/jquery.mousewheel.js']
        }, {
            test: CURRENT_PLATFORM == PLATFORM_AIR,
            yep: ['lib/air/AIRAliases.js', 'lib/air/AIRIntrospector.js']
        }, {
            test: CURRENT_PLATFORM_MOBILE,
            yep: ['lib/ui/android.css', 'lib/common-web/phonegap-1.4.1.js'],
            nope: ['lib/ui/desktop.css'],
        }, {
            load: ['sstack/sstack.css', 'sstack/datamanager.js', 'sstack/sheet.js'],
            complete: function () {
                $(function() {//Ready
                    return run();
                });
            }
        }, {
            test: CURRENT_PLATFORM_MOBILE,
            yep: ['sstack/sstack-android.css']
        }]);
    }
})

var run = function() {
    if (CURRENT_PLATFORM == PLATFORM_AIR) {
        db = new AirDBProvider('sstack');
    } else {
        db = new HTML5Provider('sstack', '1');
    }
    _initUI(db);
    if (CURRENT_PLATFORM_MOBILE) {//Empty layout
        PhoneGap.onDOMContentLoaded.fire();
        layout = new Layout({});
    } else {//Simple layout
        layout = new Layout({id: 'main'});
    };
    $('<div id="sync_indicator"/>').appendTo($('#main')).hide();
    manager = new PanelManager({
        root: $('#main'),
        minColWidth: 300
    });
    // config = new DBConfig({
    //     goBack: true,
    //     appConfig: {
    //         lotus_path: {label: 'Lotus Notes path:'},
    //         sync_url: {label: 'Sync URL:'},
    //         sync_key: {label: 'Sync key:', type: 'password'},
    //         sync_delay: {label: 'Sync delay (sec):'},
    //         storage_path: {label: 'Storage path:'},
    //         file_reveal: {label: 'File reveal command:'},
    //     },
    //     api: true,
    // });

    if (CURRENT_PLATFORM == PLATFORM_AIR) {//
        window.nativeWindow.addEventListener(air.Event.CLOSE, function() {
            air.NativeApplication.nativeApplication.exit();
        });
    };
    new TopManager();
};

var TopManager = function() {//Manages top panel
    _createEsentials(this, 'Welcome:', 2);
    this.syncButton = this.topMenu.addButton({
        caption: _buildIcon('sync', 'icon32')+'<br/>Sync',
        classNameInner: 'button_inner_32',
        classNameOuter: 'button_outer_32',
        classNameText: 'button_text_32',
        handler: _.bind(function() {//Show sheets
            this.sync();
        }, this),
    });
    this.sheetButton = this.topMenu.addButton({
        caption: _buildIcon('sheets', 'icon32')+'<br/>Sheets',
        classNameInner: 'button_inner_32',
        classNameOuter: 'button_outer_32',
        classNameText: 'button_text_32',
        handler: _.bind(function() {//Show sheets
            new SheetsManager(this.panel, this.manager);
        }, this),
    });
    // this.dateTimeButton = this.topMenu.addButton({
    //     caption: _buildIcon('calendar', 'icon32')+'<br/>Calendar',
    //     classNameInner: 'button_inner_32',
    //     classNameOuter: 'button_outer_32',
    //     classNameText: 'button_text_32',
    //     handler: _.bind(function() {//Show sheets
    //         new DateTimeSheet(this.panel, this.manager);
    //     }, this),
    // });
    this.tagsButton = this.topMenu.addButton({
        caption: _buildIcon('tags', 'icon32')+'<br/>Tags',
        classNameInner: 'button_inner_32',
        classNameOuter: 'button_outer_32',
        classNameText: 'button_text_32',
        handler: _.bind(function() {//Show sheets
            new TagsManager(this.panel, this.manager);
        }, this),
    });
    this.disabledButtons = [this.syncButton, this.sheetButton, this.tagsButton];
    this.configButton = this.topMenu.addButton({
        caption: _buildIcon('config', 'icon32')+'<br/>Config',
        classNameInner: 'button_inner_32',
        classNameOuter: 'button_outer_32',
        classNameText: 'button_text_32',
        handler: _.bind(function() {//Show tags
            var items = [];
            items.push({
                caption: 'App config',
                handler: _.bind(function() {
                    config.editAppConfig();
                    return true;
                }, this),
            });
            items.push({
                caption: 'Login',
                handler: _.bind(function() {
                    this.login();
                    return true;
                }, this),
            });
            new PopupMenu({
                element: this.panel.element,
                items: items,
            });
        }, this),
    });
    manager.show(this.panel);
    setTimeout(_.bind(function () {
        this.startManager(_.bind(function () {
            if (CURRENT_PLATFORM_MOBILE) {
                this.manager.quebec4 = new Quebec4Plugin();
            };
            new SheetsManager(this.panel, this.manager);
            this.sync();
        }, this));
    }, this), 100);
};

TopManager.prototype.sync = function() {//Run sync
    if (this.manager) {//Have manager
        //this.jsonHelper.config.url = config.appConfig.sync_url;
        //this.jsonHelper.config.key = config.appConfig.sync_key;
        $('#sync_indicator').show();
        this.syncButton.element.find('.icon32').addClass('rotating');
        _showInfo('Sync started...', 15000);
        this.syncManager.sync(_.bind(function(err) {//Run sync
            $('#sync_indicator').hide();
            this.syncButton.element.find('.icon32').removeClass('rotating');
            if (err) {//Error
                _showInfo('Error sync: '+err);
            } else {//Sync done
                $('#info_dialog').hide();
            };
        }, this));
    };
};

TopManager.prototype.autoSync = function() {//
    if (this.autoSyncID) {//Stop
        clearTimeout(this.autoSyncID);
        this.autoSyncID = null;
    };
    if (this.syncTimeout>0) {
        this.autoSyncID = setTimeout(_.bind(function() {//
            this.autoSyncID = null;
            this.sync();
        }, this), this.syncTimeout*1000);
    };
};

TopManager.prototype.login = function () {
    var body = $(document.createElement('div'));
    var username = _addInput('Username:', 'text', body);
    var password = _addInput('Password:', 'password', body);
    if (CURRENT_PLATFORM == PLATFORM_AIR) {//Activate win
        window.nativeWindow.activate();
    };
    var btns = _showQuestion('Enter username and password:', _.bind(function(index) {//Finished
        if (index == 1) {//Cancel
            return;
        };
        log('Login:', username.val(), password.val());
        this.syncManager.oauth.tokenByUsernamePassword(username.val(), password.val(), _.bind(function (err) {
            log('Auth result:', err);
            if(err) {
                _showError(err.error_description || err)
            };
            this.sync();
        }, this));
    }, this), [{caption: 'Ok'}, {caption: 'Cancel'}], body);
    // inp.delay(100).focus().keydown(_.bind(function(e) {//Key pressed
    //     if (e.which == 13) {//Emulate Ok
    //         this.click(this.buttons[0]);
    //         return false;
    //     };
    //     if (e.which == 27) {//Emulate Cancel
    //         this.click(this.buttons[1]);
    //         return false;
    //     };
    //     return true;
    // }, btns));
};

TopManager.prototype.startManager = function(handler) {//Run sync/creates manager
    for (var i = 0; i < this.disabledButtons.length; i++) {//
        this.topMenu.setDisabled(this.disabledButtons[i], true);
    };
    var storage = new StorageProvider(db)
    var jqnet = new jQueryTransport('http://lima1sync.appspot.com')
    var oauth = new OAuthProvider({
        clientID: 'sstack'
    }, jqnet);
    oauth.on_token_error = _.bind(function () {
        this.login();
    }, this);
    this.syncManager = new Lima1DataManager('sstack', oauth, storage);
    this.syncManager.on_scheduled_sync = _.bind(function () {
        this.sync();
    }, this);

    this.manager = null;
    this.syncManager.open(_.bind(function(err) {//local DB opened
        if (!err) {//
            this.manager = new DataManager(this.syncManager);
            this.manager.loadTagConfig(_.bind(function() {
                for (var i = 0; i < this.disabledButtons.length; i++) {
                    this.topMenu.setDisabled(this.disabledButtons[i], false);
                };
                if (CURRENT_PLATFORM == PLATFORM_AIR) {//
                    this.manager.getSheets(_.bind(function(data) {
                        if (data) {//Sheets inside
                            //data = this.manager.lineupSheets(data);
                            for (var i = 0; i < data.length; i++) {
                                if (data[i].visible) {//Show
                                    newSheet(data[i], this.panel, this.manager);
                                };
                            };
                        };
                    }, this));
                };
                if (handler) {//
                    handler(this.manager);
                };
            }, this))
        } else {//Error
            _showInfo('Error opening DB: '+err);
        };
    }, this))
};

var DateTimeSheet = function(panel, datamanager) {//
    this.startHour = 6;
    this.endHour = 23;
    this.manager = datamanager;
    _createEsentials(this, 'Calendar:', 1);
    _goBackFactory(this.topMenu, this.panel, '');
    this.calendarPlace = $('<div/>').addClass('calendar_place').appendTo(this.panel.element);
    this.calendar = new Calendar({
        renderTo: this.calendarPlace,
        startWeek: 1,
        // leftArrow: _buildIcon('a_left', 'icon_center'),
        // rightArrow: _buildIcon('a_right', 'icon_center'),
        handleDay: _.bind(function(div, date) {//Process date
            div.addClass('draggable').bind('dragstart', function(e) {
                dd.setDDTarget(e, tagDDType, 'd:'+date.format('yyyymmdd'));
            });
        }, this),
        daySelected: _.bind(function(date, e) {//Click on date
            newSheet({caption: date.format('m/d/yy'), tags: 'd:'+date.format('yyyymmdd'), autotags: 'd:'+date.format('yyyymmdd'), display: 'day', sort: 't:*'}, this.panel, datamanager, e.ctrlKey);
        }, this)
    });
    this.timePlace = $('<div/>').addClass('time_place').appendTo(this.panel.element);
    if (!CURRENT_PLATFORM_MOBILE) {
        for (var i = this.startHour; i <= this.endHour; i++) {
            for (var j = 0; j < 4; j++) {//15 mins
                var hr = $('<div/>').addClass('time_hour draggable').appendTo(this.timePlace);
                var tag = 't:'+(i*100+j*15);
                hr.text(datamanager.formatTag(tag));
                hr.bind('dragstart', {tag: tag}, function(e) {
                    dd.setDDTarget(e, tagDDType, e.data.tag);
                });
                if (j == 0) {//Click
                    hr.addClass('time_is_hour').bind('click', {hour: i, div: hr}, _.bind(function(e) {//Click on hour
                        e.data.div.siblings('.hour_'+e.data.hour).toggleClass('time_in_hour');
                    }, this));
                } else {//Hide
                    hr.addClass('hour_'+i).addClass('time_in_hour');
                };
            };
        };
    };
    $('<div style="clear: both;"/>').appendTo(this.timePlace);

    manager.show(this.panel, panel);
};

var SheetsManager = function(panel, datamanager) {
    this.manager = datamanager;
    _createEsentials(this, 'Sheets:', 3);
    _goBackFactory(this.topMenu, this.panel, '');
    this.topMenu.addButton({
        caption: 'Reload',
        handler: _.bind(function() {
            this.group = null;
            this.reload();
        }, this),
    });
    this.topMenu.addButton({
        caption: 'New',
        classNameInner: 'button_create',
        handler: _.bind(function() {
            this.manager.addSheet(_.bind(function(id, err) {
                if (id) {//Reload
                    this.reload();
                } else {//
                    _showError('Error adding sheet: '+err);
                };
            }, this));
        }, this),
    });
    this.calendarPlace = $('<div/>').addClass('calendar_place').appendTo(this.panel.element);
    this.calendar = new Calendar({
        renderTo: this.calendarPlace,
        startWeek: 1,
        // leftArrow: _buildIcon('a_left', 'icon_center'),
        // rightArrow: _buildIcon('a_right', 'icon_center'),
        leftArrowClass: 'button_inner',
        rightArrowClass: 'button_inner',
        handleDay: _.bind(function(div, date) {//Process date
            div.addClass('draggable').bind('dragstart', function(e) {
                dd.setDDTarget(e, tagDDType, 'd:'+date.format('yyyymmdd'));
            });
        }, this),
        daySelected: _.bind(function(date, e) {//Click on date
            newSheet({caption: date.format('m/d/yy'), tags: 'd:'+date.format('yyyymmdd'), autotags: 'd:'+date.format('yyyymmdd'), display: 'day', sort: 't:*'}, this.panel, datamanager, e.ctrlKey);
        }, this)
    });
    this.textPanel = $('<div/>').addClass('input_wrap').appendTo(this.panel.element);
    this.text = $('<input type="text"/>').addClass('form_control').appendTo(this.textPanel);
    this.text.bind('keydown', _.bind(function(e) {
        if (e.which == 13) {//Enter
            var val = this.text.val();
            if (val) {
                openTag(val, this.panel, datamanager, e.ctrlKey);
            };
            return false;
        };
        return true;
    }, this))
    this.sheetList = new Buttons({
        root: this.panel.element,
        maxElements: 2,
        safe: true,
        weights: [70, 30],
    });
    this.group = null;
    this.panel.onSwitch = _.bind(function() {
        this.reload();
    }, this);
    manager.show(this.panel, panel);
};

SheetsManager.prototype.showSheets = function(group) {//
    this.sheetList.clear();
    for (var i = 0; i < this.sheets.length; i++) {//Create buttons
        if (this.sheets[i].type == 'group') {//Group btn
            this.sheetList.addButton({
                caption: this.sheets[i].caption,
                width: 2,
                sheet: this.sheets[i],
                handler: _.bind(function(btns, btn) {
                    this.group = btn.sheet.caption;
                    this.sheets = this.manager.lineupSheets(this._list, btn.sheet.caption);
                    this.showSheets(true);
                }, this),
            });
            continue;
        };
        //var win = sheetWindows[this.sheets[i].id];
        //if (win && !group) {//Have win
            //delete sheetWindows[this.sheets[i].id];
            //win.window.nativeWindow.close();
            //newSheet(this.sheets[i], this.panel, this.manager);
        //};
        this.sheetList.addButton({
            caption: this.sheets[i].caption,
            className: 'button_left',
            classNameInner: 'button_list',
            sheet: this.sheets[i],
            handler: _.bind(function(btns, btn, e) {
                //new InlineSheet(btn.sheet, this.panel, this.manager);
                newSheet(btn.sheet, this.panel, this.manager, e.ctrlKey);
            }, this),
        });
        this.sheetList.addButton({
            caption: 'Edit',
            sheet: this.sheets[i],
            handler: _.bind(function(btns, btn) {
                new SheetEditor(btn.sheet, this.panel, this.manager);
            }, this),
        });
    };
};

SheetsManager.prototype.reload = function() {
    this.manager.getSheets(_.bind(function(list, err) {
        if (list) {
            this._list = list;
            this.sheets = this.manager.lineupSheets(list, this.group);
            this.showSheets();
        } else {
            _showError('Error loading list: '+err);
        };
    }, this));
};


var SheetEditor = function(sheet, panel, datamanager) {
    this.manager = datamanager;
    _createEsentials(this, 'Edit sheet:', 3);
    _goBackFactory(this.topMenu, this.panel, '');
    this.topMenu.addButton({
        caption: 'Save',
        handler: _.bind(function() {
            this.manager.updateSheet(sheet.id, this.form.saveForm(), _.bind(function(id, err) {
                if (id) {//Saved
                    manager.goBack(this.panel);
                } else {
                    _showError('Error updating sheet: '+err);
                };
            }, this))
        }, this),
    });
    this.topMenu.addButton({
        caption: 'Remove',
        classNameInner: 'button_remove',
        handler: _.bind(function() {
            this.manager.removeSheet(sheet.id, function(id, err) {//Removed
                if (id) {
                    manager.goBack(this.panel);
                } else {
                    _showError('Error removing sheet: '+err);
                };
            })
        }, this),
    });
    manager.show(this.panel, panel);
    this.form = new AutoForm(this.panel.element, {
        title: {label: 'Title:'},
        group: {label: 'Group:'},
        ref: {label: 'Reference:'},
        tags: {label: 'Tags:'},
        autotags: {label: 'Auto tags:'},
        sort: {label: 'Sort:'},
        display: {label: 'Display:'},
    }, 'sheet', sheet);
};

var TagsManager = function(panel, datamanager) {
    this.manager = datamanager;
    _createEsentials(this, 'Tag config:', 3);
    _goBackFactory(this.topMenu, this.panel, '');
    this.topMenu.addButton({
        caption: 'Reload',
        handler: _.bind(function() {
            this.reload();
        }, this),
    });
    this.topMenu.addButton({
        caption: 'New',
        classNameInner: 'button_create',
        handler: _.bind(function() {
            this.manager.updateTagConfig({}, _.bind(function(id, err) {
                if (id) {//Reload
                    this.reload();
                } else {//
                    _showError('Error adding tag: '+err);
                };
            }, this));
        }, this),
    });
    this.list = new Buttons({
        root: this.panel.element,
        maxElements: 1,
        safe: true,
    });
    this.panel.onSwitch = _.bind(function() {
        this.reload();
    }, this);
    manager.show(this.panel, panel);
};

TagsManager.prototype.showList = function() {//
    this.list.clear();
    for (var i = 0; i < this.config.length; i++) {//Create buttons
        var caption = this.config[i].caption;
        // if (this.config[i].tag_color) {
        //     caption = '<span style="background-color: '+this.config[i].tag_color+';">&nbsp;&nbsp;'+caption+'&nbsp;&nbsp;</span>';
        // };
        var button = this.list.addButton({
            caption: caption,
            classNameText: 'tag_button',
            config: this.config[i],
            handler: _.bind(function(btns, btn) {
                new TagsEditor(btn.config, this.panel, this.manager);
            }, this),
        });
        if (this.config[i].tag_color) {
            applyColor(button.innerElement, this.config[i].tag_color, true);
            // caption = '<span style="background-color: '+this.config[i].tag_color+';">&nbsp;&nbsp;'+caption+'&nbsp;&nbsp;</span>';
        };

    };
};

TagsManager.prototype.reload = function() {
    this.manager.loadTagConfig(_.bind(function(list, err) {
        if (list) {
            this.config = list;
            this.showList();
        } else {
            _showError('Error loading list: '+err);
        };
    }, this));
};


var TagsEditor = function(config, panel, datamanager) {
    this.manager = datamanager;
    _createEsentials(this, 'Edit Config:', 3);
    _goBackFactory(this.topMenu, this.panel, '');
    this.topMenu.addButton({
        caption: 'Save',
        handler: _.bind(function() {
            var data = this.form.saveForm();
            data.id = config.id;
            data.weight = data.weight || null;
            this.manager.updateTagConfig(data, _.bind(function(id, err) {
                if (id) {//Saved
                    manager.goBack(this.panel);
                } else {
                    _showError('Error updating config: '+err);
                };
            }, this))
        }, this),
    });
    this.topMenu.addButton({
        caption: 'Remove',
        classNameInner: 'button_remove',
        handler: _.bind(function() {
            this.manager.removeTagConfig(config.id, function(id, err) {//Removed
                if (id) {
                    manager.goBack(this.panel);
                } else {
                    _showError('Error removing config: '+err);
                };
            })
        }, this),
    });
    manager.show(this.panel, panel);
    this.form = new AutoForm(this.panel.element, {
        text: {label: 'Pattern:'},
        weight: {label: 'Weight:'},
        display: {label: 'Display:'},
        tag_color: {label: 'Tag color:', type: 'color'},
        note_color: {label: 'Note color:', type: 'color'},
    }, 'tag', config);
};

var WindowSheet = function(sheet, panel, datamanager) {//Open window
    this.sheetWidth = 300;
    if (sheet.id && sheetWindows[sheet.id]) {//
        var win = sheetWindows[sheet.id].window.nativeWindow;
        win.orderToFront();
        win.activate();
        var pos = this.getBounds(win.x, win.y);
        win.x = pos.x;
        win.y = pos.y;
        return;
    };
    var options = new air.NativeWindowInitOptions(); 
    options.systemChrome = 'none'; 
    options.type = 'lightweight';
    options.transparent = true;
    var newHTMLLoader = air.HTMLLoader.createRootWindow(true, options, false, this.getBounds(sheet.x, sheet.y));
    newHTMLLoader.load(new air.URLRequest('sheet.html'));
    var _sheet = {window: newHTMLLoader.window};
    _sheet.window.nativeWindow.alwaysInFront = true;
    newHTMLLoader.window.opener = window;
    newHTMLLoader.window.sheet = sheet;
    newHTMLLoader.window._proxy = function(method, handler, params) {
        if (method == 'closeSheet') {
            if (params[0] && sheetWindows[params[0]]) {
                delete sheetWindows[params[0]];
            };
            if (params[0]) {
                datamanager.setSheetVisibility(params[0], false, function() {
                });
            };
            handler(params[0]);
            return true;
        };
        if (method == 'moveSheet') {
            if (params[0]) {
                datamanager.moveSheet(params[0], params[1], params[2], function(id, err) {
                    handler(id, err);
                })
            } else {
                handler(params[0]);
            };
            return true;
        };
        if (method == 'openTag') {//Handle here
            openTag(params[0], panel, datamanager);
            return true;
        };
        if (method == 'copyFile') {
            return copyFileToStorage(handler);
        };
        if (method == 'openLink') {
            handler(openLink(params[0], params[1]));
            return true;
        };
        return _proxy(datamanager, method, handler, params);
    };
    if (sheet.id) {//Save
        sheetWindows[sheet.id] = _sheet;
        datamanager.setSheetVisibility(sheet.id, true, function() {
        });
    };
};

WindowSheet.prototype.getBounds = function(x, y) {
    if (x>0 && y>0) {//Check if item visible
        if (air.Screen.getScreensForRectangle(new air.Rectangle(x, y, 20, 20)).length>0) {//Visible
            return new air.Rectangle(x, y, this.sheetWidth, 20);
        };
    };
    var positions = [new air.Rectangle(window.nativeWindow.x - this.sheetWidth - 10, window.nativeWindow.y, this.sheetWidth, 20), new air.Rectangle(window.nativeWindow.x + window.nativeWindow.width + 10, window.nativeWindow.y, this.sheetWidth, 20)];
    var screens = air.Screen.getScreensForRectangle(window.nativeWindow.bounds);
    for (var i = 0; i < screens.length; i++) {
        for (var j = 0; j < positions.length; j++) {
            if (screens[i].bounds.containsRect(positions[j])) {
                return positions[j];
            };
        };
    };
    return positions[1];
};

var openTag = function(tag, panel, manager) {
    if (tag) {
        newSheet({caption: 'Tag: '+manager.formatTag(tag), tags: tag, autotags: tag}, panel, manager);
    };
};

var openLink = function(link, reveal) {
    if (!link) {
        return false;
    };
    var l = link.toLowerCase();
    if (CURRENT_PLATFORM == PLATFORM_WEB) {//window.open
        window.open(link);
        return true;
    };
    if (CURRENT_PLATFORM == PLATFORM_AIR) {//
        if (_.startsWith(l, 'notes://')) {//Open with notes
            if (!config.appConfig.lotus_path) {//Error
                _showError('No Lotus Notes configured');
                return false;
            };
            var sinfo = new air.NativeProcessStartupInfo();
            sinfo.executable = new air.File(config.appConfig.lotus_path);
            sinfo.arguments.push(link);
            var process = new air.NativeProcess();
            process.start(sinfo);
            return true;
        };
        if (_.startsWith(l, 'http://') || _.startsWith(l, 'https://')) {//
            air.navigateToURL(new air.URLRequest(link));
            return true;
        };
        try {
            var fileName = link;
            var file = null;
            if (_.startsWith(fileName, ':')) {//Storage
                var storage = config.appConfig.storage_path;
                if (!storage) {
                    _showError('Storage path is not set');
                    return false;
                };
                var stor = new air.File(storage);
                if (!stor.exists || !stor.isDirectory) {//Invalid storage
                    _showError('Storage not exists or not folder');
                    return false;
                };
                file = stor.resolvePath(fileName.substr(1));
            } else {//Direct file
                file = new air.File(fileName);
            };
            if (!file || !file.exists) {
                _showError('File/folder does not exist');
                return false;
            };
            if (reveal) {//Reveal file
                var folder = file;
                if (!file.isDirectory) {//Open parent
                    folder = file.parent;
                };
                if (config.appConfig.file_reveal) {//Have cmd
                    if (!air.NativeProcess.isSupported) {//Launch not supported
                        _showError('Feature not supported');
                        return false;
                    };
                    var cmds = config.appConfig.file_reveal.split(' ');
                    var sinfo = new air.NativeProcessStartupInfo();
                    for (var i = 0; i < cmds.length; i++) {
                        if (i == 0) {//First - executable
                            sinfo.executable = new air.File(cmds[0]);
                            continue;
                        };
                        if (cmds[i] == '%f') {//Add file
                            sinfo.arguments.push(file.nativePath);
                            continue;
                        };
                        if (cmds[i] == '%d') {//Add folder
                            sinfo.arguments.push(folder.nativePath);
                            continue;
                        };
                            sinfo.arguments.push(cmds[i]);

                        };
                        var process = new air.NativeProcess();
                        process.start(sinfo);
                    } else {//Default
                        folder.openWithDefaultApplication();
                    };
                    return true;
                } else {
                    file.openWithDefaultApplication();
                };
            } catch (e) {//File IO error
                _showError('File IO error: '+e);
                return false;
            }
            return true;
    };
};

var copyFileToStorage = function(files) {//
    var storage = config.appConfig.storage_path;
    if (!storage) {
        return null;
    };
    var stor = new air.File(storage);
    if (!stor.exists || !stor.isDirectory) {//Invalid storage
        return null;
    };
    var fname = new Date().format('yymmddHHMMss');
    var folder = stor.resolvePath(fname);
    folder.createDirectory();
    var res = [];
    for (var i = 0; i < files.length; i++) {//Copy and create file
        var f = files[i];
        files[i].copyTo(folder.resolvePath(f.name), false);
        res.push({text: ':'+f.name, link: ':'+fname+'/'+f.name});
    };
    return res;
};

var InlineSheet = function(sheet, panel, datamanager) {//
    _createEsentials(this, sheet.caption, CURRENT_PLATFORM_MOBILE? 2: 4);
    _goBackFactory(this.topMenu, this.panel, '');
    this.manager = datamanager;
    this.topMenu.addButton({
        caption: 'New',
        classNameInner: 'button_create',
        handler: _.bind(function() {
            this.sheet.newNote();
        }, this),
    });
    this.topMenu.addButton({
        caption: 'Expand',
        handler: _.bind(function() {
            this.sheet.root.find('.note_line_hide').addClass('note_line_show');
        }, this),
    });
    this.topMenu.addButton({
        caption: 'More',
        handler: _.bind(function() {
            var items = [];
            items.push({
                caption: 'Reload',
                handler: _.bind(function () {
                    this.sheet.reload();
                    return true;
                }, this)
            });
            if (CURRENT_PLATFORM_MOBILE && this.manager.quebec4) {
                items.push({
                    caption: 'Import from Quebec4',
                    handler: _.bind(function () {
                        this.sheet.importNotes(this.manager.quebec4);
                        return true;
                    }, this)
                })
            };
            // items.push({
            //     caption: 'Import from Test',
            //     handler: _.bind(function () {
            //         this.sheet.importNotes(new Quebec4Test());
            //         return true;
            //     }, this)
            // });
            new PopupMenu({
                items: items,
                element: this.panel.element
            });
            // this.sheet.reload();
        }, this),
    });
    var root = $('<div/>').addClass('inline_sheet').appendTo(this.panel.element);
    this.sheet = new Sheet(sheet, root, _.bind(function(method, handler, params) {//
        if (method == 'openTag') {//Handle here
            openTag(params[0], this.panel, datamanager);
            return true;
        };
        if (method == 'copyFile') {
            return copyFileToStorage(handler);
        };
        if (method == 'openLink') {
            handler(openLink(params[0], params[1]));
            return true;
        };
        _proxy(this.manager, method, handler || function() {}, params || []);
    }, this));
    manager.show(this.panel, panel);
};

var newSheet = function(sheet, panel, datamanager, forceinline) {//Creates new sheet
    if (CURRENT_PLATFORM == PLATFORM_AIR && !forceinline) {
        return new WindowSheet(sheet, panel, datamanager);
    } else {
        return new InlineSheet(sheet, panel, datamanager);
    };
};

var Quebec4Plugin = function () {
    PhoneGap.addConstructor(function() {
        PhoneGap.addPlugin("Quebec4", this);
    });
};

Quebec4Plugin.prototype.list = function(handler) {
    PhoneGap.exec(function (list) {
        handler(null, list);
    }, function (err) {
        handler(err || 'Phonegap error');
    }, 'Quebec4', 'list', []);
};

Quebec4Plugin.prototype.get = function(id, handler) {
    PhoneGap.exec(function (data) {
        handler(null, data);
    }, function (err) {
        handler(err || 'Phonegap error');
    }, 'Quebec4', 'get', [id]);
};

Quebec4Plugin.prototype.done = function(id) {
    PhoneGap.exec(function (data) {
    }, function (err) {
    }, 'Quebec4', 'done', [id]);
};

// var Quebec4Test = function () {
//     this.items = [{
//   "created": 1331162873995,
//   "points": [
//     {
//       "id": 61,
//       "lon": 139.6792856,
//       "created": 1331159942657,
//       "speed": 0,
//       "lat": 35.4977779,
//       "acc": 34,
//       "alt": 0
//     },
//     {
//       "id": 62,
//       "lon": 139.6793991,
//       "created": 1331160123848,
//       "speed": 0,
//       "lat": 35.4975134,
//       "acc": 25,
//       "alt": 0
//     },
//     {
//       "id": 63,
//       "lon": 139.6743254,
//       "created": 1331160304465,
//       "speed": 0,
//       "lat": 35.5038108,
//       "acc": 37,
//       "alt": 0
//     },
//     {
//       "id": 64,
//       "lon": 139.6780739,
//       "created": 1331160486982,
//       "speed": 0,
//       "lat": 35.5105486,
//       "acc": 30,
//       "alt": 0
//     },
//     {
//       "id": 65,
//       "lon": 139.7143397,
//       "created": 1331160940770,
//       "speed": 0,
//       "lat": 35.5594627,
//       "acc": 36,
//       "alt": 0
//     },
//     {
//       "id": 66,
//       "lon": 139.7416851,
//       "created": 1331161121605,
//       "speed": 0,
//       "lat": 35.6274957,
//       "acc": 29,
//       "alt": 0
//     },
//     {
//       "id": 67,
//       "lon": 139.7164573,
//       "created": 1331161440740,
//       "speed": 0,
//       "lat": 35.5633473,
//       "acc": 40,
//       "alt": 0
//     },
//     {
//       "id": 68,
//       "lon": 139.7349164,
//       "created": 1331161621963,
//       "speed": 0,
//       "lat": 35.6070725,
//       "acc": 27,
//       "alt": 0
//     },
//     {
//       "id": 69,
//       "lon": 139.7271928,
//       "created": 1331161848550,
//       "speed": 0,
//       "lat": 35.6085113,
//       "acc": 27,
//       "alt": 0
//     },
//     {
//       "id": 70,
//       "lon": 139.7125585,
//       "created": 1331162029310,
//       "speed": 0,
//       "lat": 35.60603,
//       "acc": 48,
//       "alt": 0
//     },
//     {
//       "id": 71,
//       "lon": 139.70810151658952,
//       "created": 1331162220626,
//       "speed": 5.817149639129639,
//       "lat": 35.60206243302673,
//       "acc": 5,
//       "alt": 79.0999755859375
//     },
//     {
//       "id": 72,
//       "lon": 139.7080678,
//       "created": 1331162403284,
//       "speed": 0,
//       "lat": 35.6005952,
//       "acc": 53,
//       "alt": 0
//     },
//     {
//       "id": 73,
//       "lon": 139.7078764,
//       "created": 1331162586992,
//       "speed": 0,
//       "lat": 35.6000794,
//       "acc": 24,
//       "alt": 0
//     },
//     {
//       "id": 74,
//       "lon": 139.7061661,
//       "created": 1331162812308,
//       "speed": 0,
//       "lat": 35.5989421,
//       "acc": 37,
//       "alt": 0
//     }
//   ],
//   "title": "На работу",
//   "id": 0
// }, {
//   "created": 1331121639481,
//   "point": {
//     "id": 60,
//     "lon": 139.6782793,
//     "created": 1331121573620,
//     "speed": 0,
//     "lat": 35.4989528,
//     "acc": 34,
//     "alt": 0
//   },
//   "title": "Дома",
//   "id": 1
// }]
// };

// Quebec4Test.prototype.list = function(handler) {
//     handler(null, this.items);
// };

// Quebec4Test.prototype.get = function(id, handler) {
//     handler(null, this.items[id]);
// };

// Quebec4Test.prototype.done = function(id) {

// };

