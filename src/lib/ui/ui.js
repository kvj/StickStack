var PanelManager = null;

var _showInfo = function(message, timeout) {//Shows info dialog
    if (!timeout && timeout != 0) {//Default timeout
        timeout = 2000;
    };
    //css('top', 130+document.body.scrollTop).
    var div = $('#info_dialog').text(message || '...').show().css('opacity', 0.7);
    div.click(function() {
        $(this).hide();
    })
    if (timeout>0) {//Fade
        // div.animate({opacity: 0}, timeout);
        setTimeout(function () { // Hide
            div.hide();
        }, timeout);
    };
};

var _showError = function(message) {//Shows error
    log('Error:', message);
    //css('top', 80+document.body.scrollTop).
    _disableUI();
    $('#error_dialog').html(message || 'No error message provided').show();
};

var _disableUI = function () {
    $('#error_dialog_background').children().hide();
    setTimeout(function () {
        $('#error_dialog_background').show();
    }, 1);
}

var _enableUI = function () {
    $('#error_dialog_background').hide();
}

var _hideError = function() {
    $('#error_dialog').hide();
    _enableUI();
};

var __id = 0;

var _addInput = function (title, type, parent) {
    var id = 'inp'+(++__id);
    var label = null;
    if (title) {
        label = $(document.createElement('label')).addClass('form_label').attr('for', id).text(title);
    };
    var wr = $(document.createElement('div')).addClass('input_wrap');
    var control = $(document.createElement('input')).attr('type', type).addClass('form_control').attr('id', id).appendTo(wr);
    if (parent) {
        if (label) {
            label.appendTo(parent);
        };
        wr.appendTo(parent);
    }
    return control;
}

var _ask = function (message, label, type, handler, value) {
    var body = $(document.createElement('div')).addClass('form_line');
    var input = _addInput(label, type || 'text', body);
    if (value) {
        input.val(value);
    };
    _showQuestion(message, _.bind(function (result) {
        var val = _.trim(input.val());
        if (0 == result) {
            handler(val);
        };
    }, this), null, body);
    setTimeout(function () {
        input.focus();
    }, 10);    
}

var _showQuestion = function(message, handler, buttons, element) {//Shows question dialog
    var div = $('#question_dialog');
    div.text(message);
    if (element) {//Add also element
        div.append(element);
    };
    if (!buttons) {//Add default
        buttons = [{caption: 'Yes', classNameInner: 'button_remove'}, {caption: 'No'}];
    };
    var btns = new Buttons({
        root: div,
        maxElements: buttons.length
    });
    var _keyHandler = function (e) {
        e.stop(); // Prevent other key handlers
        switch (e.keyCode) {
            case 13:
                btns.click(buttons[0]);
                return false;
            case 27: // esc
            case -10: // back button
                btns.click(buttons[buttons.length-1]);
                return false;
        }
        return true;
    };
    _keyHandler.marker = '_showQuestion';
    ui.keyListener.on('keydown', _keyHandler, true);
    _disableUI();
    for (var i = 0; i < buttons.length; i++) {//Add index and handler
        buttons[i].index = i;
        buttons[i].handler = _.bind(function(e, btn) {//Click on button
            this.div.hide();
            ui.keyListener.off('keydown', _keyHandler);
            _enableUI();
            if (this.handler) {//Have handler
                this.handler(btn.index, btn);
            };
        }, {handler: handler, div: div})
        btns.addButton(buttons[i]);
    };
    div.show();
    return btns;
};


var _defaultDBError = function(message, sql, params) {//Default DB error handler
    _showError(message.toString() || 'DB error');
};

var _fixKeyEvent = function(obj, field, e) {//Fixes key event
    if (CURRENT_PLATFORM != PLATFORM_AIR || air.Capabilities.os != 'Linux') {//Ignore
        return false;
    };
    var keys = [39, 37, 38, 40, 13, 9, 27, 46, 8, 120];
    if (_.indexOf(keys, e.which) == -1) {//Not a key
        //log('Bypass', e.which);
        return false;
    };
    var data = obj[field];
    var dt = new Date().getTime();
    if (data) {//Compare time
        //log('Check', data.key, e.which, (dt-data.time));
        if (data.key == e.which) {//Ignore
            //log('Block', data.key, e.which, (dt-data.time));
            data.key = -1;
            return true;
        };
    };
    obj[field] = {key: e.which, time: dt};
    //log('Allow', field, obj, e.which);
    return false;
};

var _goBackFactory = function(buttons, panel, icon, text) {//Creates Go back button
    if (arguments.length == 1) {//instance
        panel = buttons['panel'];
        buttons = buttons['topMenu'];
    };
    buttons.addButton({
        caption: (icon || '')+(text || 'Back'),
        handler: _.bind(function() {//Go back
            _getManager().goBack(this);
        }, panel)
    });
};

var _createEsentials = function(instance, title, maxElements, panelName, menuName) {//Creates panel and topMenu
    instance[panelName || 'panel'] = new Panel(title);
    instance[menuName || 'topMenu'] = new Buttons({
        root: instance[panelName || 'panel'].element,
        maxElements: maxElements
    });
};

var _args = null;

var _getArgument = function(name) {//Returns list of values
    if (!_args) {//No arguments
        return [];
    };
    var result = [];
    for (var i = 0; i < _args.length; i++) {//check name
        if (_args[i] == name && i<_args.length-1) {//Found and have value
            result.push(_args[i+1]);
        };
    };
    return result;
};

var _appEvents = new EventEmitter();

var _initUI = function(storage) {//Creates root UI elements
    if (window.$ && $.zepto) { // Fix bind
        $._bind = $.fn.bind;
        $.fn.bind = function (event, data, handler) { // Fix
            if (arguments.length == 3) { // Fix data
                return $._bind.call(this, event, function(e) {
                    e.data = data;
                    return handler.call(this, e);
                });
            } else {
                return $._bind.apply(this, arguments);
            }
        }
    };
    var main = $('<div id="main"/>').appendTo(document.body);
    var em = $('<div style="width: 1em; height: 1em; left: -2em; top: -2em; position: absolute; visibility: hidden;" id="__em"/>').appendTo(document.body);
    var err_bg = $('<div id="error_dialog_background"/>').appendTo(document.body).hide();
    var err = $('<div id="error_dialog" class="popup_dialog"/>').appendTo(err_bg).addClass('error_dialog').hide();
    $('<div id="question_dialog" class="popup_dialog"/>').appendTo(err_bg).addClass('question_dialog').hide();
    err.bind(CURRENT_EVENT_CLICK, function(e) {//Hide error dialog
        $('#error_dialog_background').hide();
        return false;
    });
    if (CURRENT_PLATFORM_MOBILE) {//Add back handler
        document.addEventListener('backbutton', function() {//Back button
            var e = {};
            e.keyCode = -10;// Back button
            return ui.keyListener.emit('keydown', e);
        }, true);
        document.addEventListener('searchbutton', function() {//Back button
            var e = {};
            e.keyCode = -11;// Search button
            return ui.keyListener.emit('keydown', e);
        }, true);
    };
    $('<div id="info_dialog"/>').appendTo(document.body).hide();
    ui.keyListener = new EventEmitter(this);
    $(document.body).bind('keydown', _.bind(function (e) { // Top level event handler
        return ui.keyListener.emit('keydown', e);
    }, this));
    if (CURRENT_PLATFORM == PLATFORM_AIR && storage) {//Only for air
        var w = parseInt(storage.get('window_width', '0'));
        var h = parseInt(storage.get('window_height', '0'));
        if (w>0 && h>0) {//Resize
            window.nativeWindow.width = w;
            window.nativeWindow.height = h;
        };
        if (storage.get('window_state', '') == air.NativeWindowDisplayState.MAXIMIZED) {//Maximize
            window.nativeWindow.maximize();
        };
        window.nativeWindow.addEventListener('resize', function(e) {//Window resized
            setTimeout(function() {//Save window size
                //log('Resize:', window.nativeWindow.width, $(window).width());
                storage.set('window_state', window.nativeWindow.displayState);
                if (window.nativeWindow.displayState != air.NativeWindowDisplayState.MAXIMIZED) {//Save only when not maximized
                    storage.set('window_width', window.nativeWindow.width);
                    storage.set('window_height', window.nativeWindow.height);
                };
            }, 1000);
        });
        air.NativeApplication.nativeApplication.addEventListener('invoke', function(e) {//Application invoked
            //log('INVOKE', e.arguments.length);
            //Fix arguments
            var val = null;
            var field = null;
            var args = [];
            for (var i = 0; i < e.arguments.length; i++) {//Fix
                var arg = e.arguments[i];
                //log('arg', arg, arg.length);
                if (arg && _.startsWith(arg, '-') && arg.length>1) {//Key
                    if (field) {//Save prev
                        //log('args', field, val);
                        args.push(field);
                        args.push(val);
                    };
                    field = arg;
                    val = null;
                } else {//Part of val
                    if (val == null) {//First part
                        val = arg;
                    } else {//Add space and part
                        val += ' '+arg;
                    };
                };
            };
            if (field) {//Add last
                //log('args', field, val);
                args.push(field);
                args.push(val);
            };
            if (_args == null) {//First start
                _args = args;
            } else {//Call _appEvents
                _appEvents.emit('invoke', {args: args});
            };
        });
        // log('OS:', air.Capabilities.os);
        ui.keyListener.on('keydown', _.bind(function(e) {//Fix handler
            //log('UI keydown');
            if (_fixKeyEvent(this, 'fix', e)) {//Ignore
                return false;
            };
            return true;
        }, {}), true);
    };
    return main;
};

ui.setDialogWidth = function (width) {
    $(document.createElement('style')).appendTo(document.head).text('.popup_dialog {width: '+width+'px; margin-left: -'+(width/2)+'px}');
}

ui.buildIcon = function (name, size) {
    var result = '<div class="ic'+(size>0? ' ic_'+size: ' ')+' '+name+'"></div>';
    return result;
}

ui.em = function () {
    return $('#__em').width() || 10;
};

ui.settingsPane = function (config, storage, handler, panel) {
    _createEsentials(this, 'System settings', 2);
    _goBackFactory(this.topMenu, this.panel, '');
    this.topMenu.addButton({
        caption: 'Save',
        handler: _.bind(function() {
            var data = form.saveForm();
            var keys = _.keys(data);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                storage.set(key, data[key]);
            };
            if (handler) {
                handler();
            };
            _getManager().goBack(this.panel);
        }, this),
    });
    var formDiv = $(document.createElement('div')).appendTo(this.panel.element);
    var keys = _.keys(config);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (config[key].type == 'checkbox') {
            config[key].value = storage.is(key);
        } else {
            config[key].value = storage.get(key, config[key]['default']);
        }
    };
    var form = new AutoForm(formDiv, config);
    _getManager().show(this.panel, panel);
}

var widgets = {};

widgets.widgetConfigDone = function(data) {//Done
    if (CURRENT_PLATFORM_MOBILE) {//Check config
        try {
            PhoneGap.exec(null, null, "widget", "configDone", [data]);
        } catch (e) {//Widget error
            log('Widget error: ', e);
        }
    };
};

widgets.isWidgetConfiguring = function() {//
    if (CURRENT_PLATFORM_MOBILE) {//Check config
        try {
            if (PhoneGap.exec(null, null, "widget", "isConfiguring", [])) {//
                return true;
            };
        } catch (e) {//Widget error
            log('Widget error: ', e);
        }
    };
    return false;
};

widgets.getCurrentWidgetInfo = function() {//
    if (CURRENT_PLATFORM_MOBILE) {//Check config
        try {
            return PhoneGap.exec(null, null, "widget", "getCurrentInfo", []);
        } catch (e) {//Widget error
            log('Widget error: ', e);
        }
    };
    return null;
};

widgets.getWidgetConfigs = function() {//Array
    if (CURRENT_PLATFORM_MOBILE) {//Check config
        try {
            return PhoneGap.exec(null, null, "widget", "getConfigs", []) || [];
        } catch (e) {//Widget error
            log('Widget error: ', e);
        }
    };
    return [];
};

widgets.setWidgetConfig = function(data) {
    if (CURRENT_PLATFORM_MOBILE) {//Check config
        try {
            PhoneGap.exec(null, null, "widget", "saveConfig", [parseInt(data.id), data]);
        } catch (e) {//Widget error
            log('Widget error: ', e);
        }
    };
};

widgets.getActivityExtraInt = function(name) {
    if (CURRENT_PLATFORM_MOBILE) {//Check config
        try {
            return PhoneGap.exec(null, null, "widget", "getActivityExtraInt", [name]);
        } catch (e) {//Widget error
            log('Widget error: ', e);
        }
    };
    return -1;
};

widgets.getConfig = function(id) {
    if (CURRENT_PLATFORM_MOBILE) {//Check config
        try {
            return PhoneGap.exec(null, null, "widget", "getConfig", [id]);
        } catch (e) {//Widget error
            log('Widget error: ', e);
        }
    };
    return null;
};

var _getManager = function() {//Returns manager
    return __panelManager;
};

var __panelManager = null;

var PanelManagerNavProvider = function () {
    
};

PanelManagerNavProvider.prototype.list = function() { //Returns all button configs
    return [];
};

PanelManagerNavProvider.prototype.remove = function(index) { //When nav item is about to remove
    log('Not implemented: remove', index);
};

PanelManagerNavProvider.prototype.edit = function(index) { //When nav item is about to edit
    log('Not implemented: edit', index);    
};

PanelManagerNavProvider.prototype.move = function(index, toindex) { //When nav item was moved
    log('Not implemented: move', index, toindex);    
};

PanelManagerNavProvider.prototype.handler = function(index) { //Click on nav item
    log('Not implemented: handler', index);    
};

PanelManager = function(config) {
    __panelManager = this;

    this.NAV_NORMAL = 0;
    this.NAV_EDIT = 1;
    this.NAV_MOVE_START = 2;
    this.NAV_MOVE_FINISH = 3;
    this.NAV_REMOVE = 4;
    this.config = config || {};
    this.title = this.config.title || 'No title';
    this.element = $('<div/>').addClass('panel_manager').attr('id', 'panel_manager').appendTo(this.config.root || document.body);
    this.navProvider = this.config.navProvider || null;
    if (this.navProvider) {
        this.navProvider.manager = this;
    };
    this.nav = $(document.createElement('div')).addClass('panel_manager_nav').appendTo(this.element).hide();
    this.nav.bind(CURRENT_EVENT_DOWN, _.bind(function (e) {
        if (this.nav_visible) {
            this.focus(-1);
        };
    }, this));
    this.nav_visible = false;
    this.nav_buttons = new Buttons({
        root: this.nav,
        maxElements: 1,
        handler: _.bind(this.onNavClick, this),
        buttons: [{
            caption: '|',
            classNameInner: 'button_create'
        }]
    });
    this.navMode = this.NAV_NORMAL;
    this.clear = $(document.createElement('div')).addClass('clear').appendTo(this.element);
    this.panels = [];
    this.buttonDelay = this.config.buttonDelay || 300;
    this.columns = [];
    this.minColWidth = this.config.minColWidth || 280;
    this.colGap = 5;
    this.focusDiv = $(document.createElement('div')).addClass('focus_indicator');
    this.focused = -1;
    $(window).resize(_.bind(function () {
        this.resize(true);
    }, this));
    // ui.keyListener.on('keydown', _.bind(this.keyHandler, this));
    // this.keyListener = new EventEmitter(this);
    ui.keyListener.on('keydown', _.bind(this.onKeyDown, this));
    if (this.config.navVisible && this.navProvider) {
        this.toggleNav();
    } else {
        this.resize(true);
    }
};

PanelManager.prototype.refreshNav = function() {
    if (!this.navProvider) {
        return;
    };
    this.navMode = this.NAV_NORMAL;
    var ddType = 'panel-manager/nav';
    while(this.nav_buttons.buttons.length>1) {
        this.nav_buttons.removeButton(this.nav_buttons.buttons[1]);
    };
    var arr = this.navProvider.list() || [];
    for (var i = 0; i < arr.length; i++) {
        var item = arr[i];
        var btn = this.nav_buttons.addButton(item);
        if (i<9) {
            var numDiv = $(document.createElement('div')).addClass('panel_manager_nav_num').text(''+(i+1)).appendTo(btn.element);
        };
        if (!item.draggable) {
            continue;
        };
        btn.innerElement.addClass('draggable').bind('dragstart', {index: i}, function(e) {
            dd.setDDTarget(e, ddType, e.data.index);
        }).bind('dragover', _.bind(function(e) {
            if (dd.hasDDTarget(e, ddType)) {
                e.preventDefault();
            };
        }, this)).bind('drop', {index: i},  _.bind(function(e) {//Dropped
            var drag = parseInt(dd.getDDTarget(e, ddType), 10);
            var drop = e.data.index;
            log('drop', drag, drop);
            if (drag != drop) {// Nav to Nav
                this.navProvider.move(drag, drop);
                e.stopPropagation();
                e.preventDefault();
                return false;
            };
        }, this));
    };
};

PanelManager.prototype.onNavClick = function(index, button, buttons, e) {
    //Do smth
    if (index == 0) {
        // Show menu
        this.navMode = this.NAV_NORMAL;
        new PopupMenu({
            element: this.element,
            items: [
                {
                    caption: 'Move item',
                    handler: _.bind(function () {
                        this.navMode = this.NAV_MOVE_START;
                        _showInfo('Click to target item to start move');
                        return true;
                    }, this)
                }, {
                    caption: 'Edit item',
                    handler: _.bind(function () {
                        this.navMode = this.NAV_EDIT;
                        _showInfo('Click to target item to edit');
                        return true;
                    }, this)
                }, {
                    caption: 'Remove item',
                    handler: _.bind(function () {
                        this.navMode = this.NAV_REMOVE;
                        _showInfo('Click to target item to remove');
                        return true;
                    }, this)
                }
            ]
        })
        return;
    };
    if (e.ctrlKey) {
        this.navProvider.edit(index-1);
        return;
    };
    if (e.shiftKey) {
        this.navProvider.remove(index-1);
        return;
    };
    switch (this.navMode) {
        case this.NAV_NORMAL:
            this.navProvider.handler(index-1);
            return;
        case this.NAV_EDIT:
            this.navProvider.edit(index-1);
            this.navMode = this.NAV_NORMAL;
            return;
        case this.NAV_REMOVE:
            this.navProvider.remove(index-1);
            this.navMode = this.NAV_NORMAL;
            return;
        case this.NAV_MOVE_START:
            this.navMoving = index;
            this.navMode = this.NAV_MOVE_FINISH;
            _showInfo('Click to target item to finish move');
            return;
        case this.NAV_MOVE_FINISH:
            this.navMode = this.NAV_NORMAL;
            if (this.navMoving != index) {
                this.navProvider.move(this.navMoving-1, index-1);
            } else {
                _showInfo('Same item');
            }
            return;
    }
};

PanelManager.prototype.toggleNav = function() {
    if (!this.navProvider) {
        return;
    };
    this.nav_visible = !this.nav_visible;
    if (this.nav_visible) {
        this.nav.show();
        this.refreshNav();
    } else {
        this.nav.hide();
    };
    this.resize(true);
};

PanelManager.prototype.farRight = function() {
    return Math.min(this.panels.length, this.columns.length);
};

PanelManager.prototype.focus = function(col) {
    this.element.children().removeClass('panel_focused');
    if (this.nav_visible && col == -1) {
        this.focused = -1;
        this.focusDiv.hide();
        this.nav.addClass('panel_focused');
        return;
    };
    if (!col || col<0) {
        col = 0;
    };
    var panels_displayed = this.farRight();
    if (col>=panels_displayed) {
        col = panels_displayed-1;
    };
    this.focused = col;
    if (col>=0) {
        this.columns[col].children().children('.panel_title').append(this.focusDiv.show());
        this.columns[col].addClass('panel_focused');
    };
};

PanelManager.prototype.resize = function(autoPut) {//Change layout
    var newcolcount = Math.floor($(window).width() / this.minColWidth);
    if (newcolcount == 0) {//One column always
        newcolcount = 1;
    };
    var widePanel = -1;
    var forceResize = false;
    if (this.panels.length>1 && newcolcount>1) {
        // Show more than 1 panel - check wide
        var lastPanel = this.panels[this.panels.length-1];
        var prevPanel = this.panels[this.panels.length-2];
        if (lastPanel.wide) {
            // Last panel wide
            forceResize = true; // Have wide panel
            if (prevPanel.wide) {
                // Both wide - show only last
                newcolcount = 1;
                widePanel = 0;
            } else {
                widePanel = 1;
                newcolcount = 2;
            }
        } else {
            if (prevPanel.wide) {
                // Prev wide
                forceResize = true; // Have wide panel
                widePanel = 0;
                newcolcount = 2;
            } else {
                // Normal case, no wide panels, check do we have wide panel visible
            }
        }
    };
    var resized = false;
    if (newcolcount != this.columns.length || forceResize) {//Number of cols is changed - recreate columns
        resized = true;
        this.element.children('.panel_column').remove();//Remove columns
        this.columns = [];
        for (var i = 0; i < newcolcount; i++) {//Create columns
            var col = $(document.createElement('div')).addClass('panel_column').insertBefore(this.nav);
            this.columns.push(col);
            col.bind(CURRENT_EVENT_DOWN, {index: i}, _.bind(function (e) {
                this.focus(e.data.index);
            }, this));
        };
        if (autoPut) {
            this.putPanels();
        };
    };
    var left = 0;
    var colWidths = $(window).width();
    if (this.nav_visible) {
        colWidths -= this.nav.width()+2;
    };
    var colWidth = Math.floor(colWidths / newcolcount);
    for (var i = 0; i < this.columns.length; i++) {//Resize columns
        var w = colWidth;
        if (widePanel != -1) {
            // Wide panel is visible
            if (widePanel == i) {
                // This is wide panel
                w = colWidths-this.minColWidth;
            } else {
                w = this.minColWidth;
            }
        };
        if (i == newcolcount-1) {//Last column - fix width
            w = colWidths - left;
        };
        this.columns[i].width(w-2);
        if (!CURRENT_PLATFORM_MOBILE) {
            this.columns[i].height($(document.body).height()-4);
        };
        left += w;
    };
    this.focus(this.focused);
};

PanelManager.prototype.getVisiblePanels = function() {
    var result = [];
    var i = this.panels.length-1;
    while (i>=0) {
        var panel = this.panels[i];
        // if (panel.wide && result.length>1) {
        //     // Wide panel and two panels displayed - stop
        //     return result;
        // };
        result.splice(0, 0, panel);
        if (result.length == this.columns.length) {
            // All columns
            return result;
        };
        i--;
    }
    return result;
};

PanelManager.prototype.focusByID = function(id) {
    if (!id) {
        return false;
    };
    var arr = this.getVisiblePanels();
    for (var i = 0; i < arr.length; i++) {
        var panel = arr[i];
        if (panel.id && panel.id == id) {
            this.focus(i);
            return true;
        };
    };
    return false;
};

PanelManager.prototype.putPanels = function() {//Put panels into columns
    for (var i = 0; i < this.panels.length; i++) {//Detach panels
        this.panels[i].scroll = this.panels[i].element.parent().attr('scrollTop');
        this.panels[i].element.remove();
    };
    var arr = this.getVisiblePanels();
    for (var i = 0; i < arr.length; i++) {
        var panel = arr[i];
        panel.element.appendTo(this.columns[i]);
        if (panel.scroll || panel.scroll == 0) {//Restore
            this.columns[i].attr('scrollTop', panel.scroll);
        };
        panel.onResize();
    };
};

//PanelManager.prototype.show = function(panel, current) {
    //setTimeout(function(instance, panel, current) {
        //instance._show(panel, current);
    //}, this.buttonDelay, this, panel, current);
//};

PanelManager.prototype.clearRightPanels = function(current) {
    if (current) {//Remove panels right to the current
        for (var i = 0; i < this.panels.length; i++) {//Search for position
            if (this.panels[i] == current) {//Remove all others
                for (var j = i+1; j < this.panels.length;) {//Remove panel
                    var p = this.panels[j];
                    p.element.remove();
                    this.panels.splice(j, 1);
                };
            };
        };
    };
};

PanelManager.prototype.show = function(panel, current) {
    this.clearRightPanels(current);
    this.panels.push(panel);
    this.panel = panel;
    this.resize();
    this.putPanels();
    if (panel.onSwitch) {//Switch handler
        panel.onSwitch(panel);
    };
    this.focus(this.farRight()-1);
};

PanelManager.prototype.goBack = function(current) {
    if (this.panels.length<2 || current == this.panels[0]) {//Work only for more than 2 panels in stack
        return false;
    }
    this.clearRightPanels(current);
    var p = this.panels.pop();
    p.element.remove();
    var panel = this.panels[this.panels.length-1];
    this.panel = panel;
    this.resize();
    this.putPanels();
    if (panel.onSwitch) {//Switch handler
        panel.onSwitch(panel);
    };
    this.focus(this.farRight()-1);
    return true;
};

PanelManager.prototype.setTitle = function(panel) {
    var prefix = this.config.titlePrefix || '';
    if (panel.title) {
        document.title = prefix + panel.title;
    } else {
        document.title = prefix + this.title;
    }
};

PanelManager.prototype.getFocused = function() {
    if (this.focused == -1) {
        return null;
    };
    var skipPanels = this.panels.length - this.columns.length;
    if (skipPanels<0) {//Fix
        skipPanels = 0;
    };
    return this.panels[skipPanels+this.focused];        
};

PanelManager.prototype.onKeyDown = function(e) {
    if (e.keyCode == -10) {
        //Back button
        if (this.goBack(this.getFocused())) {//Have go back
            this.warningShown = false;
        } else {//Exit app
            if (!this.warningShown) {//Show warning
                this.warningShown = true;
                _showInfo('Press again to exit');
            } else {//Exit
                navigator.app.exitApp();
                return true;
            };
        };
        return false;
    };
    if (e.altKey) {
        // 39 ->
        // 37 <-
        // 38 ^
        if (e.keyCode>=48 && e.keyCode<=57 && this.nav_visible) {
            var buttonIndex = e.keyCode-48;
            if (buttonIndex<this.nav_buttons.buttons.length) {
                this.nav_buttons.click(this.nav_buttons.buttons[buttonIndex]);
                return false;
            };
            // 0-9
        };
        switch (e.keyCode) {
            case 39:
                this.focus(this.focused+1);
                return false;
            case 37:
                this.focus(this.focused-1);
                return false;
            case 40:
                this.focus(-1);
                return false;
            case 38:
                this.goBack(this.getFocused());
                return false;
            case 77:  // m - menu
                var panel = this.getFocused();
                if (panel && panel.onmenu) {
                    panel.onmenu();
                    return false;
                }
                break;
        };
        // log('Key down panel', e.keyCode);
    };
    if (this.focused == -1 && this.nav_visible) {
        return this.nav_buttons.keypress(e);
    };
    var panel = this.getFocused();
    if (panel && panel.keypress) {
        if (false === panel.keypress(e)) {
            return false;
        };
    };
    // if (this.panel && this.panel.keys[e.which]) {
    //     var obj = this.panel.keys[e.which].obj;
    //     var handler = this.panel.keys[e.which].handler;
    //     e.data = this.panel.keys[e.which].data;
    //     return handler.call(obj, e);
    // }
    return true;
};

PanelManager.prototype.keyHandler = function(e) {
    return this.keyListener.emit('keydown', e);
};

var Panel = function(title) {
    this.element = $(document.createElement('div')).addClass('panel');
    this.titleElement = $(document.createElement('div')).addClass('panel_title').appendTo(this.element);
    this.title = title;
    this.titleElement.text(title);
    this.keys = {};
    this.wide = false;
};

Panel.prototype.onResize = function() {
    // By default no action required
};

Panel.prototype.setTitle = function(title) {
    this.title = title;
    this.titleElement.text(title);
};

Panel.prototype.addKeyHandler = function(key, obj, handler, data) {
    //log('Adding key handler', key, obj);
    var o = {obj: obj, data: data || {}, handler: handler};
    this.keys[key] = o;
    return o;
};

ui.installAutoCompleteSupport = function (config) { // Adds auto complete support to input
    var element = config.element;
    var parent = element.parent();
    var div = $(document.createElement('div')).addClass('input_autocomplete');
    $(document.createElement('div')).addClass('clear').appendTo(div);
    element.after(div);
    var redrawCandidates = function (result) { // Creates buttons
        div.children('.button_outer').remove();
        candidates = [];
        for (var i = 0; i < result.length; i++) { // Create buttons
            var outer = $(document.createElement('div')).appendTo(div).addClass('button_outer');
            var inner = $(document.createElement('button')).appendTo(outer).addClass('button_inner');
            if (i == 0) { // Add class to first button
                inner.addClass('button_create');
            };
            var caption = result[i].caption;
            var text = $(document.createElement('div')).appendTo(inner).addClass('button_text');
            if (config.onrender) { // Have onrender handler - call external
                config.onrender(text, caption, result[i].value);
            } else { // Use HTML
                text.html(caption);
            };
            candidates.push(result[i].value);
            outer.bind('click', {index: i}, function (e) { // Click handler
                if (e.ctrlKey) { // Ctrl pressed - replace input with candidate
                    element.val(candidates[e.data.index]);
                } else { // Finish input
                    config.onfinish(candidates[e.data.index]);
                };
                return false; // Prevent default
            });
        };
    };
    var candidates = [];
    element.bind('keydown', function (e) { // Intersect keyboard
        if (e.which == 13) { // Enter pressed
            if (e.ctrlKey && candidates.length>0) { // Ctrl pressed and have candidate - search
                config.onfinish(candidates[0]);
                return false;
            };
            config.onfinish(_.trim(element.val()));
            return false; // Prevent default
        };
        setTimeout(function () { // Need a time to process button
            var val = _.trim(element.val());
            if (!val) { // Empty input - empty candidates
                redrawCandidates([]);
            } else { // Do search
                config.onsearch(val, function (err, result) { // Search done
                    if (err) { // Show error
                        _showInfo('Error while searching: '+err);
                    } else { // Show results
                        redrawCandidates(result);
                    };
                })
            };
        }, 0);
    });
}

var Buttons = function(config) {//Cool buttons
    this.config = config || {};
    this.readonly = this.config.readonly || false;
    this.element = $('<div/>').addClass('buttons');
    this.focusDiv = $(document.createElement('div')).addClass('focus_indicator');
    this.focused = 0;
    this.row = $(document.createElement('div')).addClass('buttons_row').appendTo(this.element);
    this.buttonRows = [];
    if (this.config.root) {//Attach to parent
        this.element.appendTo(this.config.root);
    };
    this.buttons = [];
    if (this.config.buttons) {
        for (var i = 0; i < this.config.buttons.length; i++) {
            this.addButton(this.config.buttons[i]);
        };
    };
    // this._clear = $('<div/>').css('clear', 'both').appendTo(this.element);//Float: left fix
};

Buttons.prototype.keypress = function(e) {
    if (this.readonly) {
        return false;
    };
    switch (e.keyCode) {
        case 38: // up
            if (this.focus(this.focused-1)) {
                return false;
            };
            return true;
        case 40: // down
            if (this.focus(this.focused+1)) {
                return false;
            };
            return true;
        case 13: // enter - open
            if (this.buttons[this.focused]) {
                this.click(this.buttons[this.focused]);
                return false;
            };
            return true;
    }
    return true;
};

Buttons.prototype.getRow = function(row) {
    var r = row || 0;
    if (!this.buttonRows[r]) {
        for (var i = this.buttonRows.length; i <= r; i++) {
            var div = $(document.createElement('div')).addClass('buttons_cell').appendTo(this.row);
            if (this.config.rows && this.config.rows[r]) {
                div.width(this.config.rows[r]);
            };
            $(document.createElement('div')).css('clear', 'both').appendTo(div);//Float: left fix
            this.buttonRows.push(div);
        };
    };
    return this.buttonRows[r];
};

Buttons.prototype.addButton = function(button, before) {//Adds button
    button.delay = this.config.delay || 100;
    var row = this.getRow(button.row);
    button.element = $('<div/>').addClass('button_outer').insertBefore(before? before.element: row.children().last());
    button.innerElement = $('<button/>').addClass('button_inner').appendTo(button.element);
    if (this.readonly) {
        button.innerElement.attr('disabled', 'disabled');
        button.element.addClass('button_readonly');
    };
    button.innerElement.bind(this.config.fast? CURRENT_EVENT_DOWN: 'click', {buttons: this, button: button, index: this.buttons.length}, function(e) {//Click on button
        if (e.data.button.disabled || e.data.buttons.readonly) {//Ignore click
            return false;
        };
        e.data.buttons.focus(e.data.index);
        if (e.data.button.handler) {//We have handler
            e.data.button.handler(e, e.data.button, e);
            return false;
        } else {
            if (e.data.buttons.config.handler) {
                e.data.buttons.config.handler(e.data.index, e.data.button, e.data.buttons, e);
            };
        }
        //e.preventDefault();
        //e.stopPropagation();
        return false;
    });
    button.textElement = $('<div/>').addClass('button_text').appendTo(button.innerElement);
    button.textElement.html(button.caption);
    this.buttons.push(button);
    if (button.className) {//Additional class
        button.element.addClass(button.className);
    };
    if (button.classNameInner) {//Additional class
        button.innerElement.addClass(button.classNameInner);
    };
    if (button.classNameOuter) {//Additional class
        button.element.addClass(button.classNameOuter);
    };
    if (button.classNameText) {//Additional class
        button.textElement.addClass(button.classNameText);
    };
    if (button.css) {
        button.innerElement.css(button.css);
    };
    this.updateWidth();
    if (button.id && button.id == this.focusedID) {
        this.focus(this.buttons.length-1);
    };
    return button;
};

Buttons.prototype.focus = function(item) {
    var result = true;
    if (!item || item<0) {
        result = false;
        item = 0;
    };
    if (item>=this.buttons.length) {
        result = false;
        item = this.buttons.length-1;
    };
    this.focused = item;
    if (!this.buttons[item]) {
        return false;
    };
    this.focusDiv.appendTo(this.buttons[item].innerElement);
    this.buttons[item].innerElement.focus();
    return true;
};

Buttons.prototype.click = function(button) {//Simulate click
    button.innerElement.trigger('click');
};

Buttons.prototype.setCaption = function(button, text) {//Changes text on button
    button.textElement.html(text);
};

Buttons.prototype.setDisabled = function(button, disabled) {//Changes disabled state
    if (disabled) {//Add class
        button.element.addClass('button_disabled');
    } else {
        button.element.removeClass('button_disabled');
    };
    button.disabled = disabled || false;
};

Buttons.prototype.removeButton = function(button) {//Removes button
    for (var i = 0; i < this.buttons.length; i++) {
        if (this.buttons[i] == button) {//Found
            button.element.remove();
            this.buttons.splice(i, 1);
            this.updateWidth();
            return true;
        };
    };
    return false;
};

Buttons.prototype.clear = function() {//Removes all buttons
    this.focusedID = null;
    if (this.buttons[this.focused] && this.buttons[this.focused].id) {
        this.focusedID = this.buttons[this.focused].id;
    };
    this.focused = -1;
    this.buttons = [];
    this.element.find('.button_outer').remove();
    this.updateWidth();
};

Buttons.prototype.updateWidth = function() {//Recalculate width
    if (this.config.maxElements) {//Calculate height
        var ws = [];
        if (this.config.weights && this.config.weights.length == this.config.maxElements) {//Have weights
            ws = this.config.weights;
        } else {//No weight
            for (var i = 0; i < this.config.maxElements; i++) {//Create equal weights
                var pcent = Math.floor(10000/Math.min(this.config.maxElements, this.buttons.length));
                ws.push(pcent/100);
            };
        };
        var slot = 0;
        for (var i = 0; i < this.buttons.length; i++) {//Change width acc. to weights
            var w = 0;
            for (var j = 0; j < (this.buttons[i].width || 1); j++) {//
                w += ws[slot % this.config.maxElements];
                slot++;
            };
            this.buttons[i].element.css('width', ''+w+'%');
        };
    };
    // if (this.config.centered) {//Calculate

    // };
};

var TabManager = function(config) {//Wrapper over Buttons
    this.config = config || {};
    this.buttons = new Buttons(config.buttons);
    this.element = config.root;
    this.tabs = [];
    this.current = null;
};

TabManager.prototype.addTab = function(obj, before) {//Adds tab
    if (!obj || !obj.button) {//Invalid object
        log('Error: Invalid tab');
        return;
    };
    this.tabs.push(obj);
    if (obj.button.className) {//Add tab class
        obj.button.className += ' tab_button';
    } else {//Set tab class
        obj.button.className = 'tab_button';
    };
    obj.button.handler = _.bind(function(e, btn) {//Button selected
        for (var i = 0; i < this.tabs.length; i++) {//Search selected tab
            if (this.tabs[i].button == btn) {//Found
                this.showTab(this.tabs[i]);
                return;
            };
        };
    }, this);
    this.buttons.addButton(obj.button, before? before.button: null);
    if (this.tabs.length == 1) {//First tab
        this.showTab(obj);
    };
    if (window.layout) {//Have layout
        layout.resize();
    };
};

TabManager.prototype.getTab = function(tid) {//Searches tab by ID
    for (var id = 0; id < this.tabs.length; id++) {//
        if (this.tabs[id].id == tid) {//Found tab
            return this.tabs[id];
        };
    };
    return null;
};

TabManager.prototype.removeTab = function(tab) {//Removes tab
    for (var i = 0; i < this.tabs.length; i++) {//Look for tab
        if (this.tabs[i] == tab) {//Found tab. Remove button
            this.buttons.removeButton(tab.button);
            this.tabs.splice(i, 1);
            return true;
        };
    };
    return false;
};

TabManager.prototype.showTab = function(tab) {//Hides other and calls show
    this.buttons.element.find('.tab_button_selected').removeClass('tab_button_selected');
    this.element.children().hide();
    this.current = tab;
    tab.button.element.addClass('tab_button_selected');
    if (tab.show) {//Show handler
        tab.show.call(tab);
    };
};

TabManager.prototype.clear = function(leave) {//Clears TabManager
    for (var i = 0; i < this.tabs.length; i++) {//Look for tab
        if (this.tabs[i] != leave) {//Remove
            this.removeTab(this.tabs[i]);
            i--;
        } else {//Show tab
            this.showTab(leave);
        }
    }
};

var __visiblePopupMenu = null;

var PopupMenu = function(config) {//Shows popup menu
    this.config = config || {};
    var body = $(document.body);
    var parent = this.config.element? this.config.element: body;
    this.menu = $('<div/>').addClass('popup_menu').appendTo(parent);
    var width = Math.floor(parent.width()*0.8);
    var maxWidth = 20*ui.em();
    if (width>maxWidth) {
        width = maxWidth;
    };
    this.menu.data('instance', this);
    this.menu.css('left', parent.offset().left+(parent.width()-width)/2).width(width);
//    log('scroll', document.body.scrollTop, parent.parent().scrollTop(), parent.scrollTop());
    this.items = this.config.items || [];
    this.items.push({caption: 'Cancel'});
    for (var i = 0; i < this.items.length; i++) {//Create menu items
        var mitem = $('<button/>').addClass('popup_menu_item').appendTo(this.menu);
        var prefix = '';
        if (this.config.numbering != false) {
            prefix = i<9 ? ''+(i+1)+': ': '';
        };
        if (this.config.html) {//HTML mode
            mitem.html(prefix+this.items[i].caption || '&nbsp;');
        } else {//Text mode
            mitem.text(prefix+this.items[i].caption || '');
        };
        if (i == 0) {//Add class
            mitem.addClass('popup_menu_item_first');
        };
        if (this.items[i].cls) {
            mitem.addClass(this.items[i].cls);
        };
        mitem.bind('click', {item: this.items[i], index: i, element: mitem, instance: this}, _.bind(function(e) {//Click on item
            e.stopPropagation();
            e.preventDefault();
            if (e.data.index == e.data.instance.items.length-1) {//Last item - hide menu
                e.data.instance.hide();
                return false;
            };
            if (e.data.item.handler) {//Item handler
                var result = e.data.item.handler(e.data.item, e.data.index);
                if (result) {//Close menu
                    e.data.instance.hide();
                    return false;
                };
                return false;
            };
            if (e.data.instance.config.handler) {
                var result = e.data.instance.config.handler(e.data.item, e.data.index);
                if (result) {//Close menu
                    e.data.instance.hide();
                };
            };
            return false;
        }, this));
    };
    if (__visiblePopupMenu) {//Close other menus
        __visiblePopupMenu.hide();
    };
    this.visible = true;
    __visiblePopupMenu = this;
    _disableUI();
    this.keyHandler = _.bind(this.keyPressed, this);
    ui.keyListener.on('keydown', this.keyHandler, true);
};

PopupMenu.prototype.keyPressed = function(e) {//
    e.stop(); // Prevent other key handlers
    if (e.keyCode>=49 && e.keyCode<=57) {//1-9
        var index = e.which-49;//0-8
        this.menu.children('.popup_menu_item').eq(index).trigger('click');
        return false;
    };
    if (e.keyCode == 27 || e.keyCode == -10) {//Esc or back
        this.menu.children('.popup_menu_item').last().trigger('click');
        return false;
    };
    return false;
};

PopupMenu.prototype.hide = function() {//Hides menu
    if (!this.visible) {
        return false;
    };
    _enableUI();
    ui.keyListener.off('keydown', this.keyHandler);
    this.menu.remove();
    this.visible = false;
    if (__visiblePopupMenu == this) {//
        __visiblePopupMenu = null;
    };
    return true;
};

var AutoForm = function(element, config, formid, values, handler) {//Creates and handles form
    this.conf = config || {};
    this.element = $(element);
    var values = values || {};
    this.formid = formid || 'form';
    for (var id in this.conf) {//Create control
        if (!this.conf[id].label) {
            continue;
        };
        var val = this.conf[id].value || values[id] || '';
        if (this.conf[id].type == 'checkbox') {//Checkbox
            var wr = $('<div/>').addClass('input_wrap').appendTo(this.element);
            var control = $('<input type="checkbox" '+((this.conf[id].value || values[id])? 'checked': '')+'/>').addClass('form_control').attr('id', this.formid+id).appendTo(wr).val('on');
            var label = $('<label/>').addClass('form_label').attr('for', this.formid+id).text(this.conf[id].label || '').appendTo(wr);
        } else {//Other elements
            var label = $('<label/>').addClass('form_label').attr('for', this.formid+id).text(this.conf[id].label || '').appendTo(this.element);
            if (this.conf[id].type == 'textarea') {//Textarea
                var wr = $('<div/>').addClass('area_wrap').appendTo(this.element);
                var control = $('<textarea/>').addClass('form_control').attr('id', this.formid+id).appendTo(wr).val(this.conf[id].value || values[id] || '');
                control.autoGrow(10);
            } else {//Input
                var wr = $('<div/>').addClass('input_wrap').appendTo(this.element);
                var control = $('<input/>').attr('type', this.conf[id].type? this.conf[id].type: 'text').addClass('form_control').attr('id', this.formid+id).appendTo(wr).val(this.conf[id].value || values[id] || '');
                if (handler) {
                    control.bind('keydown', _.bind(function(e) {
                        if (e.which == 13) {//Enter
                            handler(this.saveForm());
                            return false;
                        };
                        return true;
                    }, this))
                };
                if (this.conf[id].type == 'password' && this.conf[id].password) {//Special password type
                    control.val('');
                };
                if (this.conf[id].type == 'color') {
                    if(_.isArray(val)) {
                        control.val('#'+val[0].toString(16)+val[1].toString(16)+val[2].toString(16));
                    }
                };
            };
        };
    };
};

AutoForm.prototype.loadForm = function(values) {
    for (var id in this.conf) {//Create control
        if (!this.conf[id].label) {
            continue;
        };
        var item = this.element.find('#'+this.formid+id);
        item.val(values[id] || '');
    };
};

AutoForm.prototype.saveForm = function(old) {//Saves values
    var result = {};
    for (var id in this.conf) {//Create control
        if (!this.conf[id].label) {
            continue;
        };
        var value = this.element.find('#'+this.formid+id);
        if (this.conf[id].type == 'checkbox') {//Special case
            // log('Checked', value.attr('checked'), value.val(), value.attr('selected'), this.formid+id);
            value = value.attr('checked')? true: false;
            result[id] = value;
        } else if (this.conf[id].type == 'password' && this.conf[id].password == 'sha1') {//Special case - sha1 password
            var pass = value.val();
            if (pass) {//Make hash
                value = hex_sha1(pass);
            } else {//Old
                if (old) {
                    value = old[id];
                } else {
                    continue;
                }
            };
        } else {//Simple edit
            value = _.trim(value.val());
        };
        log('Save', id, value);
        result[id] = value;
    };
    return result;
};

var _locker = null;

var _initScreenLocker = function(config) { // element, timeout, password, startLock, showTime
    _locker = new ScreenLocker(config);
    /*
    {
        element: element,
        timeout: timeout,
        password: password,
        time: showTime
    }
    */
    if (config.startLock) {//Lock now
        setTimeout(_.bind(_locker.doLock, _locker), 1);
    };
    return _locker;
};

// var _updateScreenLocker = function(timeout, password) {
//     if (_locker) {
//         _locker.config.timeout = timeout;
//         _locker.config.password = password;
//     };
// };

var _lockScreen = function() {
    if (_locker) {//Lock
        _locker.doLock();
    };
};

var ScreenLocker = function(config) {
    this.config = config || {};
    this.locked = false;
    this.lastActive = new Date().getTime();
    $(document.body).bind('keydown', _.bind(this.keyPressed, this));
    $(document.body).bind('mousedown', _.bind(this.mousePressed, this));
    setInterval(_.bind(this.checkTimeout, this), 20000);
};

ScreenLocker.prototype.checkTimeout = function() {//Interval
    if (this.locked) {//Skip
        return;
    };
    if (this.config.timeout>0) {//Have timeout
        var secsLeft = Math.round((new Date().getTime()-this.lastActive)/1000);
        if (secsLeft>parseInt(this.config.timeout, 10)) {//Reached timeout
            // log('Secs left', secsLeft);
            this.doLock();
            // _showInfo('Locked by timeout: '+secsLeft, 0);
        };
    };
};

ScreenLocker.prototype.keyPressed = function(e) {//Key handler
    this.lastActive = new Date().getTime();
    if (!this.locked) {//Normal mode
        if (e.which == 121) {//F10
            this.doLock();
            return false;
        };
    } else {//Lock mode
        //log('Key', e.which);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (e.which == 13) {//Enter
            this.checkPassword(true);
        };
        if (e.which == 27) {//Esc
            this.resetPassword();
        };
        if (e.which>=48 && e.which<=57) {//Add number
            this.addNumber(''+(e.which-48));
        };
        if (e.which>=96 && e.which<=105) {//Add number
            this.addNumber(''+(e.which-96));
        };
        return false;
    };
    return true;
};

ScreenLocker.prototype.mousePressed = function(e) {//Mouse handler
    this.lastActive = new Date().getTime();
    if (!this.locked) {//Reset activity
    };
    return true;
};

ScreenLocker.prototype.checkPassword = function(handle_error) {//Check and unlock
    var hash = hex_sha1(this.password);
    if (hash == this.config.password) {//Unlock
        this.locked = false;
        this.locker.remove();
        this.locker = null;
        this.config.element.css('visibility', 'visible');
        if (this.timeID) {
            clearInterval(this.timeID);
        };
        // setTimeout(function() {
        //     layout.resize();
        // }, 1);
    } else {//Show error
        if (handle_error) {
            this.resetPassword();
            _showError('Invalid password');            
        };
    };
};

ScreenLocker.prototype.showTime = function() {
    var dt = new Date();
    this.timeDiv.text(dt.format('HH:MM:ss'));
};

ScreenLocker.prototype.doLock = function() {//Hides element and draws lock
    if (!this.config.password) {//No password - no lock
        _showInfo('Lock password not set');
        return false;
    };
    this.locked = true;
    this.config.element.css('visibility', 'hidden');
    this.password = '';
    this.stars = '';
    this.locker = $('<div/>').addClass('locker popup_dialog').appendTo(document.body);
    if (this.config.time) {
        this.timeDiv = $(document.createElement('div')).addClass('lock_icon locker_time').appendTo(this.locker);
        this.timeID = setInterval(_.bind(this.showTime, this), 1000);
        this.showTime();
    };
    this.lockerPass = $('<div/>').addClass('locker_pass').appendTo(this.locker).html('&nbsp;');
    var btns = $('<div/>').appendTo(this.locker);
    this.buttons = new Buttons({
        maxElements: 3,
        fast: true,
        root: btns
    });
    var arr = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', 'X', 'O'];
    for (var i = 0; i < arr.length; i++) {//Add buttons
        this.buttons.addButton({
            caption: arr[i],
            action: arr[i],
            className: 'locker_btn',
            classNameText: 'lock_icon',
            classNameInner: arr[i] == 'X'? 'button_remove': arr[i] == 'O'? 'button_create': null,
            handler: _.bind(function(btns, btn) {//Click on button
                if (btn.action == 'X') {//Reset pass
                    this.resetPassword();
                } else if (btn.action == 'O') {//Check pass
                    this.checkPassword(true);
                } else {//Numbers
                    this.addNumber(btn.action);
                };
            }, this)
        });
    };
};

ScreenLocker.prototype.resetPassword = function() {
    this.password = '';
    this.stars = '';
    this.lockerPass.html('&nbsp;');
    _hideError();
};

ScreenLocker.prototype.addNumber = function(num) {
    _hideError();
    this.password += num;
    this.stars += '*';
    this.lockerPass.text(this.stars);
    this.checkPassword(false);
};

var installSwipeHandler = function(element, handler, data) {//Sets gesture event
    var startX = 0;
    var startY = 0;
    var dist = 70;
    if (CURRENT_PLATFORM_MOBILE) {//Only for mobile
        element.bind('touchstart', function(evt) {//Touch is started - save coords
            startX = evt.originalEvent.touches[0].pageX;
            startY = evt.originalEvent.touches[0].pageY;
        });
        element.bind('touchmove', function(evt) {//Touch is started - save coords
            if (evt.originalEvent.changedTouches.length == 0) {//No changed
                return true;
            };
            var x = evt.originalEvent.changedTouches[0].pageX;
            var y = evt.originalEvent.changedTouches[0].pageY;
            if (!startX || !startY || !x || !y) {//Invalid values
                return true;
            };
            var d = x-startX;
            if (d>=dist) {//Call handler
                handler(data, element);
                return false;
            };
        });
    };
};

var openToolWindow = function(url, _proxy, config) {//
    var options = new air.NativeWindowInitOptions(); 
    options.systemChrome = 'none'; 
    options.type = 'lightweight';
    options.transparent = true;
    var newHTMLLoader = air.HTMLLoader.createRootWindow(true, options, false, new air.Rectangle(config.x, config.y, config.width, config.height));
    newHTMLLoader.load(new air.URLRequest(url));
    newHTMLLoader.window.nativeWindow.alwaysInFront = true;
    newHTMLLoader.window.opener = window;
    newHTMLLoader.window._proxy = _proxy;
    return newHTMLLoader.window;
};
