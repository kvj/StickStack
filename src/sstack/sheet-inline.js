var main = null;

var controller = null;

$(function() {//
    if (CURRENT_PLATFORM == PLATFORM_AIR) {
        window.nativeWindow.addEventListener(air.Event.CLOSE, function() {
        });
        window.nativeWindow.addEventListener(air.Event.CLOSING, function(e) {
            e.preventDefault();
        });
        window.nativeWindow.addEventListener('move', function(e) {
            setTimeout(_.bind(function() {//
                this.move(window.nativeWindow.x, window.nativeWindow.y);
            }, controller), 500);
        });
    };
    main = $('<div/>').addClass('sheet_root').appendTo(document.body);
    var _top = $('<div/>').addClass('sheet_top draggable').appendTo(main).attr('draggable', 'true');
    _top.bind('dragstart', function(e) {
        e.preventDefault();
        window.nativeWindow.startMove();
    });
    _top.bind('dblclick', function(e) {//new note
        controller.newNote();
        e.preventDefault();
        return false;
    })
    //_top.bind('dragover', function(e) {
        //if (dd.hasDDTarget(e, noteDDType)) {
            //e.preventDefault();
        //};
    //});
    //_top.bind('drop', function(e) {
        //if (dd.hasDDTarget(e, noteDDType)) {
            //var drop = dd.getDDTarget(e, noteDDType);
            //controller.proxy('moveNote', _.bind(function(id, err) {//
                //if (id) {
                    //this.reload();
                //};
            //}, controller), [drop, controller.data.autotags]);
            //e.preventDefault();
        //};
    //});
    main.bind('mousewheel', function(e){
        var direction = e.wheelDelta>0? -1: 1;
        var opacity = parseFloat(main.css('opacity')) || 1.0;
        opacity += 0.1*direction;
        opacity = opacity<0.1? 0.1: (opacity>1? 1: opacity);
        main.css('opacity', opacity);
        return false;
    });
    $('<div style="float: left;"/>').appendTo(_top).text(sheet.caption || '');
    $('<div style="float: right; cursor: pointer;"/>').appendTo(_top).append($(_buildIcon('eye')).bind('click', function(e) {
        controller.root.find('.note_line_hide').addClass('note_line_show');
        controller.updated();
        return false;
    })).append($(_buildIcon('update')).bind('click', function(e) {
        controller.reload();
        return false;
    })).append($(_buildIcon('close')).bind('click', function(e) {
        closeWindow();
        return false;
    }));
    $('<div style="clear: both;"/>').appendTo(_top);
    var sheet_div = $('<div/>').addClass('sheet_div').appendTo(main);
    controller = new Sheet(sheet, sheet_div, _proxy);
    controller.updated = function() {
        window.nativeWindow.height = main.outerHeight();
    };
    controller.enableNoteDrop(_top, function(n) {
        if (n.id) {//note drop
            controller.proxy('moveNote', _.bind(function(id, err) {//
                if (id) {
                    this.reload();
                };
            }, controller), [n.id, controller.data.autotags]);
        } else {//Put note
            controller.proxy('putNote', _.bind(function(id, err) {//
                if (id) {
                    this.reload();
                };
            }, controller), [n, controller.data.autotags]);
        };
    })
    $(document).bind('keydown', _.bind(function(e) {
        //log('keydown', e.which);
        if (this.editing) {
            return true;
        };
        if (e.which == 45) {//Insert - new note
            this.newNote();
            return false;
        };
    }, controller));
});

var closeWindow = function() {
    controller.close(function() {
        window.nativeWindow.close();
    });
};
