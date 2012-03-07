var PanelManager = null;

var _showInfo = function(message, timeout) {//Shows info dialog
    if (!timeout && timeout != 0) {//Default timeout
        timeout = 2000;
    };
    var div = $('#info_dialog').text(message || '...').css('top', 130+document.body.scrollTop).stop().clearQueue().show().css('opacity', 0.7);
    div.click(function() {
        $(this).hide();
    })
    if (timeout>0) {//Fade
        div.fadeOut(timeout);
    };
};

var _showError = function(message) {//Shows error
    log('Error:', message);
    $('#error_dialog').css('top', 50+document.body.scrollTop).html(message || 'No error message provided');
    $('#error_dialog_background').show();
};

var _hideError = function() {
    $('#error_dialog_background').hide();
};

var __id = 0;

var _addInput = function (title, type, parent) {
    var id = 'inp'+(++__id);
    var label = $('<label/>').addClass('form_label').attr('for', id).text(title);
    var wr = $('<div/>').addClass('input_wrap');
    var control = $('<input/>').attr('type', type).addClass('form_control').attr('id', id).appendTo(wr);
    if (parent) {
        label.appendTo(parent);
        wr.appendTo(parent);
    }
    return control;
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
    for (var i = 0; i < buttons.length; i++) {//Add index and handler
        buttons[i].index = i;
        buttons[i].handler = _.bind(function(e, btn) {//Click on button
            this.div.hide();
            if (this.handler) {//Have handler
                this.handler(btn.index, btn);
            };
        }, {handler: handler, div: div})
        btns.addButton(buttons[i]);
    };
    div.css('top', 20+document.body.scrollTop).show();
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
    var main = $('<div id="main"/>').appendTo(document.body);
    $('<div id="question_dialog"/>').appendTo(document.body).addClass('question_dialog').hide();
    var err_bg = $('<div id="error_dialog_background"/>').appendTo(document.body).hide();
    var err = $('<div id="error_dialog"/>').appendTo(err_bg).addClass('error_dialog');
    err.bind(CURRENT_EVENT_CLICK, function(e) {//Hide error dialog
        $('#error_dialog_background').hide();
        return false;
    });
    var warningShown = false;
    if (CURRENT_PLATFORM_MOBILE) {//Add back handler
        document.addEventListener('backbutton', function() {//Back button
            if (__visiblePopupMenu) {//Have visible menu
                if (__visiblePopupMenu.hide()) {//Was hidden menu
                    return false;
                };
            };
            var m = _getManager();
            if (m && m.goBack()) {//Have go back
                warningShown = false;
            } else {//Exit app
                if (!warningShown) {//Show warning
                    warningShown = true;
                    _showInfo('Press again to exit');
                } else {//Exit
                    navigator.app.exitApp();
                    return true;
                };
            };
        }, true);
    };
    $('<div id="info_dialog"/>').appendTo(document.body).hide();
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
        log('OS:', air.Capabilities.os);
        $(document.body).bind('keydown', _.bind(function(e) {//Fix handler
            //log('UI keydown');
            if (_fixKeyEvent(this, 'fix', e)) {//Ignore
                return false;
            };
            return true;
        }, {}));
    };
    return main;
};

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
    return window.manager? window.manager: null;
};

if (CURRENT_PLATFORM_MOBILE) {

    PanelManager = function(config) {
        this.config = config || {};
        this.title = this.config.title || 'No title';
        this.element = $('<div/>').addClass('panel_manager').appendTo(this.config.root || document.body);
        this.panels = [];
        this.buttonDelay = this.config.buttonDelay || 300;
    };

    //PanelManager.prototype.show = function(panel) {
        //setTimeout(function(instance, panel) {
            //instance._show(panel);
        //}, this.buttonDelay, this, panel);
    //};

    PanelManager.prototype.show = function(panel) {
        if (this.panels.length>0) {
            this.panels[this.panels.length-1].scrollTop = document.body.scrollTop;
        }
        this.element.find('.panel').hide();
        this.panels.push(panel);
        panel.element.appendTo(this.element);
        panel.element.show();
        this.setTitle(panel);
        this.panel = panel;
        if (panel.onSwitch) {//Switch handler
            panel.onSwitch(panel);
        };
    };

    PanelManager.prototype.goBack = function() {
        if (this.panels.length<2) {//Work only for more than 2 panels in stack
            return false;
        }
        var p = this.panels.pop();
        this.element.find('.panel').hide();
        p.element.hide();
        var panel = this.panels[this.panels.length-1]; 
        panel.element.show();
        if(panel.scrollTop) {
            document.body.scrollTop = panel.scrollTop;
            //log('Restore scroll top', panel.scrollTop);
        }
        this.setTitle(panel);
        this.panel = panel;
        if (panel.onSwitch) {//Switch handler
            panel.onSwitch(panel);
        };
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

} else {//Desktop version
    PanelManager = function(config) {
        this.config = config || {};
        this.title = this.config.title || 'No title';
        this.element = $('<div/>').addClass('panel_manager').appendTo(this.config.root || document.body);
        this.panels = [];
        this.buttonDelay = this.config.buttonDelay || 300;
        this.columns = [];
        this.minColWidth = this.config.minColWidth || 280;
        this.colGap = 5;
        $(window).resize(_.bind(this.resize, this));
        //$(document).keypress({instance: this}, function(e) {
            ////log('Key', e.which);
            ////49 50 51 52 - 1-4
            ////104 - h
            ////99 - c
            ////98 - b
            ////107 - k
            ////115 - s
            ////119 - w
            ////118 - v
            ////103 - g
            ////return e.data.instance.keyHandler(e);
        //});
        this.resize();
    };

    PanelManager.prototype.resize = function() {//Change layout
        var newcolcount = Math.floor($(window).width() / this.minColWidth);
        if (newcolcount == 0) {//One column always
            newcolcount = 1;
        };
        if (newcolcount != this.columns.length) {//Number of cols is changed - recreate columns
            for (var i = 0; i < this.panels.length; i++) {//Detach panels
                this.panels[i].element.detach();
            };
            this.element.children('.panel_column').remove();//Remove columns
            this.columns = [];
            for (var i = 0; i < newcolcount; i++) {//Create columns
                var col = $('<div/>').addClass('panel_column').appendTo(this.element);
                this.columns.push(col);
                col.css('position', 'absolute').css('top', this.colGap).css('bottom', this.colGap);
            };
            this.putPanels();
        };
        var left = this.colGap;
        var colWidth = Math.floor($(window).width() / newcolcount);
        for (var i = 0; i < this.columns.length; i++) {//Resize columns
            var w = colWidth;
            if (i == newcolcount-1) {//Last column - fix width
                w = $(window).width() - left - this.colGap;
            };
            this.columns[i].css('left', left).width(w);
            left += w+this.colGap;
        };
    };

    PanelManager.prototype.putPanels = function() {//Put panels into columns
        for (var i = 0; i < this.panels.length; i++) {//Detach panels
            this.panels[i].scroll = this.panels[i].element.parent().scrollTop();
            this.panels[i].element.detach();
        };
        var skipPanels = this.panels.length - this.columns.length;
        if (skipPanels<0) {//Fix
            skipPanels = 0;
        };
        for (var i = 0; i < Math.min(this.panels.length, this.columns.length); i++) {//Put panels
            var panel = this.panels[i+skipPanels];
            panel.element.appendTo(this.columns[i]);
            if (panel.scroll || panel.scroll == 0) {//Restore
                this.columns[i].scrollTop(panel.scroll);
            };
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
                        p.element.detach();
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
        this.putPanels();
        if (panel.onSwitch) {//Switch handler
            panel.onSwitch(panel);
        };
    };

    PanelManager.prototype.goBack = function(current) {
        if (this.panels.length<2) {//Work only for more than 2 panels in stack
            return false;
        }
        this.clearRightPanels(current);
        var p = this.panels.pop();
        p.element.detach();
        var panel = this.panels[this.panels.length-1];
        this.panel = panel;
        this.putPanels();
        if (panel.onSwitch) {//Switch handler
            panel.onSwitch(panel);
        };
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

    PanelManager.prototype.keyHandler = function(e) {
        if (this.panel && this.panel.keys[e.which]) {
            var obj = this.panel.keys[e.which].obj;
            var handler = this.panel.keys[e.which].handler;
            e.data = this.panel.keys[e.which].data;
            return handler.call(obj, e);
        }
    };

};

var Panel = function(title) {
    this.element = $('<div/>').addClass('panel');
    this.titleElement = $('<div/>').addClass('panel_title').appendTo(this.element);
    this.title = title;
    this.titleElement.text(title);
    this.keys = {};
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

var Buttons = function(config) {//Cool buttons
    this.config = config || {};
    this.element = $('<div/>').addClass('buttons');
    if (this.config.root) {//Attach to parent
        this.element.appendTo(this.config.root);
    };
    this.buttons = [];
    this._clear = $('<div/>').css('clear', 'both').appendTo(this.element);//Float: left fix
};

Buttons.prototype.addButton = function(button, before) {//Adds button
    button.delay = this.config.delay || 100;
    button.element = $('<div/>').addClass('button_outer').insertBefore(before? before.element: this._clear);
    button.innerElement = $('<button/>').addClass('button_inner').appendTo(button.element);
    button.innerElement.bind((this.config.safe | button.safe)?  'click': CURRENT_EVENT_CLICK, {buttons: this, button: button}, function(e) {//Click on button
        if (e.data.button.disabled) {//Ignore click
            return false;
        };
        // e.data.button.element.addClass('button_pressed');
        // setTimeout(_.bind(function() {//Call handler
        //     this.data.button.element.removeClass('button_pressed');
        //     if (this.data.button.handler) {//We have handler
        //         return this.data.button.handler(this, this.data.button, this);
        //     };
        // }, e), e.data.button.delay);
        if (e.data.button.handler) {//We have handler
            e.data.button.handler(e, e.data.button, e);
            return false;
        };
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
    return button;
};

Buttons.prototype.click = function(button) {//Simulate click
    button.innerElement.trigger((this.config.safe | button.safe)?  'click': CURRENT_EVENT_CLICK);
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
    if (this.config.centered) {//Calculate

    };
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
    var parent = this.config.element? this.config.element: this.config.panel.element;
    this.menu = $('<div/>').addClass('popup_menu').appendTo(parent);
    this.menu.data('instance', this);
    this.menu.css('top', document.body.scrollTop+parent.parent().scrollTop());
    //log('scroll', document.body.scrollTop, this.config.panel.element.parent().scrollTop(), manager.element.scrollTop());
    this.items = this.config.items || [];
    this.items.push({caption: 'Cancel'});
    for (var i = 0; i < this.items.length; i++) {//Create menu items
        var mitem = $('<div/>').addClass('popup_menu_item').appendTo(this.menu);
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
    this.keyHandler = _.bind(this.keyPressed, this);
    $(document.body).bind('keydown', this.keyHandler);
};

PopupMenu.prototype.keyPressed = function(e) {//
    //log('Menu key', e.which);
    if (e.which>=49 && e.which<=57) {//1-9
        var index = e.which-49;//0-8
        this.menu.children('.popup_menu_item').eq(index).click();
        return false;
    };
    if (e.which == 27) {//Esc
        this.menu.children('.popup_menu_item').last().click();
        return false;
    };
    return true;
};

PopupMenu.prototype.hide = function() {//Hides menu
    if (!this.visible) {
        return false;
    };
    $(document.body).unbind('keydown', this.keyHandler);
    this.menu.remove();
    this.visible = false;
    if (__visiblePopupMenu == this) {//
        __visiblePopupMenu = null;
    };
    return true;
};

var AutoForm = function(element, config, formid, values) {//Creates and handles form
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
            var control = $('<input/>').attr('type', 'checkbox').addClass('form_control').attr('id', this.formid+id).appendTo(wr).attr('checked', (this.conf[id].value || values[id])? true: false);
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

AutoForm.prototype.saveForm = function(old) {//Saves values
    var result = {};
    for (var id in this.conf) {//Create control
        if (!this.conf[id].label) {
            continue;
        };
        var value = this.element.find('#'+this.formid+id);
        if (this.conf[id].type == 'checkbox') {//Special case
            value = value.attr('checked')? true: false;
        } else if (this.conf[id].type == 'password' && this.conf[id].password == 'md5' && old) {//Special case - md5 password
            var pass = value.val();
            if (pass) {//Make hash
                value = sha1.hex_md5(pass);
            } else {//Old
                value = old[id];
            };
        } else {//Simple edit
            value = _.trim(value.val());
        };
        result[id] = value;
    };
    return result;
};

var _locker = null;

var _initScreenLocker = function(element, timeout, password, startLock) {
    if (CURRENT_PLATFORM_MOBILE) {//No screen lock
        return null;
    };
    _locker = new ScreenLocker({
        element: element,
        timeout: timeout,
        password: password
    });
    if (startLock) {//Lock now
        setTimeout(_.bind(_locker.doLock, _locker), 100);
    };
    return _locker;
};

var _updateScreenLocker = function(timeout, password) {
    if (_locker) {
        _locker.config.timeout = timeout;
        _locker.config.password = password;
    };
};

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
        if (secsLeft>this.config.timeout) {//Reached timeout
            log('Secs left', secsLeft);
            this.doLock();
            _showInfo('Locked by timeout: '+secsLeft, 0);
        };
    };
};

ScreenLocker.prototype.keyPressed = function(e) {//Key handler
    this.lastActive = new Date().getTime();
    if (!this.locked) {//Normal mode
        if (e.which == 119) {//F8
            this.doLock();
            return false;
        };
    } else {//Lock mode
        //log('Key', e.which);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (e.which == 13) {//Enter
            this.checkPassword();
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

ScreenLocker.prototype.checkPassword = function() {//Check and unlock
    var hash = sha1.hex_md5(this.password);
    if (hash == this.config.password) {//Unlock
        this.locked = false;
        this.locker.remove();
        this.locker = null;
        this.config.element.show();
        setTimeout(function() {
            layout.resize();
        }, 100);
    } else {//Show error
        this.resetPassword();
        _showError('Invalid password');
    };
};

ScreenLocker.prototype.doLock = function() {//Hides element and draws lock
    if (!this.config.password) {//No password - no lock
        _showInfo('Lock password not set');
        return false;
    };
    this.locked = true;
    this.config.element.hide();
    this.password = '';
    this.stars = '';
    this.locker = $('<div/>').addClass('locker').appendTo(document.body);
    this.lockerPass = $('<div/>').addClass('locker_pass').appendTo(this.locker).html('&nbsp;');
    var btns = $('<div/>').appendTo(this.locker);
    this.buttons = new Buttons({
        maxElements: 3,
        root: btns
    });
    var arr = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', 'X', 'OK'];
    for (var i = 0; i < arr.length; i++) {//Add buttons
        this.buttons.addButton({
            caption: arr[i],
            action: arr[i],
            className: 'locker_btn',
            handler: _.bind(function(btns, btn) {//Click on button
                if (btn.action == 'X') {//Reset pass
                    this.resetPassword();
                } else if (btn.action == 'OK') {//Check pass
                    this.checkPassword();
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
    this.stars += 'X';
    this.lockerPass.text(this.stars);
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
