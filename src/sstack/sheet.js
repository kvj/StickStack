var tagDDType = 'sstack/tag';
var noteDDType = 'sstack/note';
var timeDDType = 'sstack/time';

var _buildIcon = function(name, cl) {//Builds img html
    return '<div class="icon'+(cl? ' '+cl: '')+'" style="background-image: url(\'img/icons/'+name+'.png\');"/>';
};

var Sheet = function(sheet, element, proxy, menuPlace) {//
    this.data = sheet;
    this.autotags = this.data.autotags;
    if (!this.autotags && this.data.id) {
        this.autotags = 's:'+this.data.id+' ';
    };
    this.root = element;
    this.proxy = proxy;
    this.mediaGap = 8;
    this.menuPlace = menuPlace;
    this.areaPanel = $('<div/>').addClass('area_wrap').appendTo(this.root).hide();
    this.area = $('<textarea/>').addClass('form_control').appendTo(this.areaPanel);
    this.area.autoGrow(10);
    var menuDiv = $(document.createElement('div')).addClass('sheet_menu').appendTo(this.root).hide();
    this.menu = new Buttons({
        root: menuDiv,
        rows: [0, '2.5em'],
        maxElements: 3,
        safe: true,
    });
    this.menu.addButton({
        caption: '+ Tag',
        classNameInner: 'button_create',
        handler: _.bind(function() {//Add tag
            this.startTextEdit(this.selected.id, this.selected.div, 'tag');
        }, this)
    });
    this.menu.addButton({
        caption: 'Edit',
        handler: _.bind(function() {//Edit note
            this.editNote(this.selected, this.selected.div);
        }, this)
    });
    this.menu.addButton({
        caption: 'Remove',
        classNameInner: 'button_remove',
        handler: _.bind(function() {//
            if (this.selected.selectedTag) {
                _showQuestion('Remove tag?', _.bind(function (index) {
                    if (0 == index) {
                        this.proxy('removeTag', _.bind(function(id, err) {//
                            if (id) {
                                this.reload();
                            };
                        }, this), [this.selected.id, this.selected.selectedTag.id]);
                    };
                }, this))
            } else {
                _showQuestion('Remove note?', _.bind(function (index) {
                    if (0 == index) {
                        this.proxy('removeNote', _.bind(function(id, err) {//Removed
                            if (id) {
                                this.reload();
                            };
                        }, this), [this.selected.id]);
                    };
                }, this));                
            }
            this.updated();
        }, this)
    });
    this.menu.addButton({
        caption: '|',
        width: 3,
        row: 1,
        handler: _.bind(function() {//
            var items = [];
            if (this.selected.selectedTag) {
                items.push({
                    caption: 'Edit tag',
                    handler: _.bind(function() {
                        this.startTextEdit(this.selected.id, this.selected.div, 'tag', this.selected.selectedTag.id);
                        return true;
                    }, this),
                });
                items.push({
                    caption: 'Select tag',
                    handler: _.bind(function() {
                        this.proxy('openTag', null, [this.selected.selectedTag.id]);
                        return true;
                    }, this),
                });
                this.launchTagMethod(this.selected, 'menu', this.selected.selectedTag.id, items);       
            };
            items.push({
                caption: 'Open note',
                handler: _.bind(function() {
                    this.openNote(this.selected);
                    return true;
                }, this),
            });
            new PopupMenu({
                element: menuPlace || this.root,
                items: items,
            });
            this.updated();
        }, this)
    });
    this.area.bind('keydown', _.bind(function(e) {
        if (e.which == 13) {//Enter
            var val = this.area.val() || '';
            if (_.endsWith(val, '\n') || e.ctrlKey) {//Double enter or Ctrl enter - finish
                this.area.val('');
                this.area.blur();
                this.editAreaDone(_.trim(val));
                return false;
            };
        };
        return true;
    }, this));
    this.area.bind('keyup', _.bind(function(e) {
        this.updated();
        return true;
    }, this));
    this.textPanel = $('<div/>').addClass('input_wrap').appendTo(this.root).hide();
    this.text = $('<input type="text"/>').addClass('form_control').appendTo(this.textPanel);
    this.text.bind('keydown', _.bind(function(e) {
        if (e.which == 13) {//Enter
            this.editTextDone(this.text.val());
            return false;
        };
        return true;
    }, this))
    this.editing = false;
    this.selected = null;
    $(document.createElement('div')).addClass('clear').appendTo(this.root);
    if (this.data.display && this['prepare_'+this.data.display]) {
        this['prepare_'+this.data.display].call(this);
    };
    this.reload();
};

Sheet.prototype.launchTagMethod = function(note, method, tag) {
    for (var j = 0; j < note.tags_captions.length; j++) {//Display tags
        var t = note.tags_captions[j];
        if (tag && t.id != tag) {
            continue;
        };
        if (t.display) {
            var m = 'tag_'+method+'_'+t.display;
            if (this[m]) {
                var params = [note, t.id];
                for (var i = 3; i < arguments.length; i++) {
                    params.push(arguments[i]);
                };
                var result = this[m].apply(this, params);
                if (result === true) {
                    return true;
                };
            };
        };
    };
    return false;
};

Sheet.prototype.tag_unselect_file = function(note, tag) {
    if (note.fileCreated) {
        note.div.find('.file').remove();
        note.fileCreated = false;
    };
};

Sheet.prototype.tag_select_file = function(note, tag) {
    if (!note.fileCreated) {
        note.fileCreated = true;
        var frame = $(document.createElement('div')).addClass('file note_frame note_line_hide').appendTo(note.div);
        // log('Show file', tag);
        var name = tag.substr(2);
        if (_.endsWith(name, '.jpg')) {
            var loading = $(document.createElement('div')).addClass('file_loading note_line_hide').appendTo(frame).text('Loading...');
            this.proxy('getAttachment', _.bind(function (err, uri) {
                loading.remove();
                if (err) {
                    return _showInfo(err);
                };
                var img = $(document.createElement('img')).addClass('file_image note_image').appendTo(frame);
                img.bind('load', _.bind(function () {
                    var width = note.div.innerWidth()-2*this.mediaGap;
                    var iw = img.width();
                    var ih = img.height();
                    var mul = width / iw;
                    iw *= mul;
                    ih *= mul;
                    img.width(Math.floor(iw)).height(Math.floor(ih));
                    this.updated();
                }, this));
                img.attr('src', uri);
            }, this), [name]);
            
        };
    };
};


Sheet.prototype.tag_menu_geo = function(note, tag, items) {
    items.push({
        caption: 'Edit location',
        handler: _.bind(function () {
            this.proxy('editMap', _.bind(function () {
                this.reload(note.id);
            }, this), [[{
                id: note.id,
                data: tag
            }]]);
            return true;
        }, this)
    })
};

Sheet.prototype.tag_menu_sheet = function(note, tag, items) {
    items.push({
        caption: 'Open sheet',
        handler: _.bind(function () {
            this.proxy('openMap', _.bind(function () {
            }, this), [tag.substr(2)]);
            return true;
        }, this)
    })
};

Sheet.prototype.tag_unselect_geo = function(note, tag) {
    if (note.geoCreated) {
        note.div.find('.geo').remove();
        note.geoCreated = false;
    };
};

Sheet.prototype.tag_select_geo = function(note, tag) {
    // log('Ready to show geo', tag);
    if (!note.geoCreated) {
        var point = splitPoint(tag);
        note.geoCreated = true;
        if (point.lat && point.lon) {
            var width = note.div.innerWidth()-2*this.mediaGap;
            var height = Math.floor(width*0.75);
            var frame = $(document.createElement('div')).addClass('geo note_frame note_line_hide').appendTo(note.div);
            var img = $(document.createElement('img')).addClass('geo_image note_image').appendTo(frame);
            img.attr('src', 'http://maps.google.com/maps/api/staticmap?center='+point.lat+','+point.lon+'&zoom=15&size='+width+'x'+height+'&sensor=true&markers=color:red|size:mid|'+point.lat+','+point.lon);
            img.bind('click', _.bind(function (e) {
                var link = '';
                if (CURRENT_PLATFORM_MOBILE) {
                    link = 'geo:'+point.lat+','+point.lon;
                } else {
                    link = 'http://maps.google.com/maps?q='+point.lat+','+point.lon+'&z=18';
                };
                this.proxy('openLink', _.bind(function(res) {
                }, this), [link, e.ctrlKey]);
                return false;
            }, this))
            img.width(width).height(height);
        };
    };
};

var splitPoint = function (tag) {
    var arr = tag.split(':');
    var point = {};
    for (var i = 0; i < arr.length; i++) {
        var item = arr[i];
        var vp = item.split('=');
        if (vp.length == 2) {
            point[vp[0]] = vp[1];
        };
    };
    return point;
};

Sheet.prototype.tag_unselect_path = function(note, tag) {
    if (note.geoCreated) {
        note.div.find('.path').remove();
        note.geoCreated = false;
    };
};

Sheet.prototype.tag_build_after_ok = function(note, tag, afterStr) {
    if (tag.length>3) {
        afterStr.splice(0, 0, tag.substr(3));
    };
};

Sheet.prototype.tag_show_link = function(note, tag, div) {
    var a = $(document.createElement('a')).addClass('tag_link').appendTo(div.empty()).text('link').attr('href', '#');
    a.bind('click', _.bind(function (e) {
        if (e.shiftKey) {
            return true;
        };
        this.proxy('openLink', _.bind(function(res) {
        }, this), [tag.substr(2), e.ctrlKey]);
        return false;
    }, this))
};

Sheet.prototype.tag_menu_path = function(note, tag, items) {
    items.push({
        caption: 'Edit path',
        handler: _.bind(function () {
            this.proxy('loadNotes', _.bind(function(list, err) {//
                if (list && list.length>0) {//Display list
                    var path = [];
                    for (var i = 0; i < list.length; i++) {
                        var n = list[i];
                        var tags = n.tags || [];
                        // log('Tags', tags, n);
                        var pointTag = null;
                        for (var j = 0; j < tags.length; j++) {
                            if (_.startsWith(tags[j], 'g:')) {
                                pointTag = tags[j];
                                break;
                            };
                        };
                        if (!pointTag) {
                            continue;
                        };
                        path.push({
                            id: n.id,
                            data: pointTag
                        })
                    };
                    this.proxy('editMap', _.bind(function () {
                        this.reload(note.id);
                    }, this), [path]);
                } else {
                    _showInfo('Path not found')
                }
            }, this), ['n:'+note.id+' g:*']);
            return true;
        }, this)
    })
};

Sheet.prototype.tag_show_note_contact = function(note, tag, text, lines) {
    var first_line = $(document.createElement('div')).addClass('note_line').appendTo(text);
    $(document.createElement('div')).addClass('note_contact_title').appendTo(first_line).text(tag.substr('contact:'.length));
    var second_line = $(document.createElement('div')).addClass('note_line').appendTo(text);
    var table = $(document.createElement('div')).addClass('note_contact_table').css('display', 'table').appendTo(second_line);
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i]
        var nameWords = [];
        var valueWords = [];
        var signFound = false;
        for (var j = 0; j < line.length; j++) {
            var word = line[j];
            if (!signFound) {
                nameWords.push(word);
                if (word.type == 'text' && _.endsWith(word.text, ':')) {
                    signFound = true;
                };
            } else {
                valueWords.push(word);
            }
        };
        var row = $(document.createElement('div')).addClass('note_contact_row').css('display', 'table-row').appendTo(table);
        var nameCell = $(document.createElement('div')).addClass('note_contact_cell note_contact_name_cell').css('display', 'table-cell').appendTo(row);
        var valueCell = $(document.createElement('div')).addClass('note_contact_cell note_contact_value_cell').css('display', 'table-cell').appendTo(row);
        this.renderLine(note, nameWords, nameCell);
        this.renderLine(note, valueWords, valueCell);
    };
    return true;
};

Sheet.prototype.tag_edit_note_contact = function(note, tag) {
    this.proxy('editContact', _.bind(function(text, name) {
        this.proxy('editNoteField', _.bind(function(id, err) {//
            if (id) {
                this.proxy('addTag', _.bind(function(id, err) {//
                    this.reload(note.id);
                }, this), [id, tag, 'contact:'+name]);
            };
        }, this), [note.id, text]);
        this.reload(note.id);
    }, this), [note, tag]);
    return true;
};

Sheet.prototype.tag_select_path = function(note, tag) {
    // log('Ready to show geo', tag);
    if (!note.pathCreated) {
        var point = splitPoint(tag);
        note.pathCreated = true;
        var frame = $(document.createElement('div')).addClass('path note_frame note_line_hide').appendTo(note.div);
        this.proxy('loadNotes', _.bind(function(list, err) {//
            if (list && list.length>0) {//Display list
                // log('Points:', list.length);
                var path = ['color:0x0000ff', 'weight: 3'];
                for (var i = 0; i < list.length; i++) {
                    var n = list[i];
                    var tags = n.tags || [];
                    // log('Tags', tags, n);
                    var pointTag = null;
                    for (var j = 0; j < tags.length; j++) {
                        if (_.startsWith(tags[j], 'g:')) {
                            pointTag = tags[j];
                            break;
                        };
                    };
                    if (!pointTag) {
                        continue;
                    };
                    var point = splitPoint(pointTag);
                    if (point.lat && point.lon) {
                        path.push(''+point.lat+','+point.lon);
                    }
                };
                var width = note.div.innerWidth()-2*this.mediaGap;
                var height = Math.floor(width*0.75);
                var img = $(document.createElement('img')).addClass('geo_image note_image').appendTo(frame);
                img.attr('src', 'http://maps.google.com/maps/api/staticmap?size='+width+'x'+height+'&sensor=true&path='+path.join('|'));
                img.width(width).height(height);
            } else {
                _showInfo('Path not found')
            }
        }, this), ['n:'+note.id+' g:*']);
    };
};

Sheet.prototype.editTextDone = function(val) {//Edit tag/link/ref
    var method = null;
    if (this.editField == 'tag') {
        method = 'addTag';
        val = _.trim(val || '');
        var params = [this.editID];
        if (this.editValue) {
            params.push(this.editValue, val);
        } else {
            params.push(val);
        }
        this.proxy(method, _.bind(function(id, err) {//
            if (id) {
                this.reload();
            };
        }, this), params);
    } else {
        val = _.trim(val || '');
        this.proxy('editNoteField', _.bind(function(id, err) {//
            if (id) {
                this.reload();
            };
        }, this), [this.editID, val, this.editField]);
    };
    this.text.val('');
    this.text.blur();
};

var fixFloat = function (fl, round) {
    if (!fl) {
        return 0;
    };
    if (!round) {
        return fl;
    };
    return Math.round(fl*round)/round;
};

Sheet.prototype.pointToTag = function(point) {
    return 'g:lat='+fixFloat(point.lat)+':lon='+fixFloat(point.lon)+':sp='+fixFloat(point.speed, 100)+':acc='+fixFloat(point.acc, 100)+':alt='+fixFloat(point.alt, 100)+':tstamp='+point.created;
};

Sheet.prototype.importNotes = function(provider) {
    provider.list(_.bind(function (err, list) {
        if (err) {
            return _showError(err);
        };
        var items = [];
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            log('item', item.id, item.title);
            items.push({
                taskID: item.id,
                caption: item.title
            });
        };
        new PopupMenu({
            element: this.menuPlace || this.root,
            items: items,
            handler: _.bind(function (item) {
                // log('Getting task:', item.taskID);
                provider.get(item.taskID, _.bind(function (err, task) {
                    if (err) {
                        return _showError(err);
                    };
                    var tags = this.autotags;
                    // log('Task', task, _.keys(task));
                    if (task.created>0) {
                        var dt = new Date(task.created);
                        tags += ' d:'+dt.format('yyyymmdd')+' t:'+(dt.getHours()*100+Math.floor(dt.getMinutes()/15)*15);
                    };
                    if (task.id) {
                        delete task.id;
                    };
                    if (task.title) {
                        task.text = task.title;
                        delete task.title;
                    };
                    var media = null;
                    if (task.media) {
                        media = task.media;
                        delete task.media;
                    };
                    var points = null;
                    if (task.point) {
                        tags +=' '+this.pointToTag(task.point);
                        delete task.point;
                    };
                    if (task.points) {
                        points = task.points;
                        delete task.points;
                        tags += ' p:';
                    };
                    // log('Create note', task, tags);
                    this.proxy('putNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload(id);
                            _showInfo('Item imported');
                            if (media) {
                                this.proxy('createAttachment', _.bind(function (err) {
                                    if (!err) {
                                        this.reload(id);
                                    };
                                }, this), [id, media]);
                            };
                            provider.done(item.taskID, function (err) {
                                
                            });
                            for (var i = 0; points && i < points.length; i++) {
                                var point = points[i];
                                var n = {
                                    text: new Date(point.created).format('m/d/yy h:MMt')
                                }
                                this.proxy('putNote', _.bind(function (id, err) {
                                    
                                }, this), [n, 'n:'+id+' '+this.pointToTag(point)]);
                            };
                        };
                    }, this), [task, tags]);
                    
                }, this))
                return true;
            }, this)
        });
    }, this))
};

Sheet.prototype.editAreaDone = function(val) {//Creates new note
    if (this.editID) {//Edit existing
        this.proxy('editNoteField', _.bind(function(id, err) {//
            if (id) {
                this.reload(id);
            };
        }, this), [this.editID, val]);
    } else {//Create new
        this.proxy('createNote', _.bind(function(id, err) {//
            if (id) {
                this.reload(id);
            };
        }, this), [val, this.autotags+(this.newTags? ' '+this.newTags: '')]);
    };
};

var applyColor = function (div, color, gradient) {
    if (!color) {
        return false;
    }
    var step = 32;
    // if (!gradient) {
        div.css('background-color', 'rgb('+color[0]+', '+color[1]+', '+color[2]+')').css('border-color', 'rgb('+(color[0]-3*step)+', '+(color[1]-3*step)+', '+(color[2]-3*step)+')');
    // } else {
    //     div.addClass('has_gradient').css('background-image', '-webkit-gradient(linear, left top, left bottom, color-stop(0%, rgb('+(color[0]+step)+', '+(color[1]+step)+', '+(color[2]+step)+')), color-stop(20%, rgb('+(color[0]-step)+', '+(color[1]-step)+', '+(color[2]-step)+')), color-stop(100%, rgb('+(color[0]+step)+', '+(color[1]+step)+', '+(color[2]+step)+')))').css('border-color', 'rgb('+(color[0]-3*step)+', '+(color[1]-3*step)+', '+(color[2]-3*step)+')')
    // }
    return true;
}

Sheet.prototype.selectNote = function(note) {
    if (this.selected != note) {
        if (this.selected) {
            this.launchTagMethod(this.selected, 'unselect');
        };
        this.launchTagMethod(note, 'select');
    };
    this.selected = note;
    note.div.addClass('note_selected');
    note.div.after(this.menu.element.detach().show());
    note.selectedTag = null;
    this.root.find('.note_tag').removeClass('note_tag_selected');
    this.root.find('.note_line_show').removeClass('note_line_show');
    var note_inline = note.note_inline;
    if (note_inline) {
        note_inline.detach();
    };
    note.div.children('.note_line_hide').add(note.div.children('.note_text').find('.note_line_hide')).addClass('note_line_show');
    if (note_inline) {
        note_inline.appendTo(note.div);
    };
    // log('Select note', note.tags);
    this.moveNowLine();
    this.updated();
};

Sheet.prototype.unselectNote = function() {
    this.root.find('.note_line_show').removeClass('note_line_show');
    this.root.find('.note_selected').removeClass('note_selected');
    if (this.selected) {
        this.selected.div.find('.note_tag').removeClass('note_tag_selected');
        this.selected.selectedTag = null;
    };
    this.selected = null;
    this.menu.element.hide();
    this.updated();
};

Sheet.prototype.showTag = function(note, t, parent, remove) {//
    var tag = $('<div/>').addClass('note_tag draggable').attr('draggable', 'true').appendTo(parent);
    if (t.tag_display) {
        tag.addClass('note_tag_display_'+t.tag_display);
    };
    applyColor(tag, t.color, true);
    tag.text(t.caption);
    this.launchTagMethod(note, 'show', t.id, tag);
    tag.bind('dblclick', {tag: t}, _.bind(function(e) {
        e.preventDefault();
        this.newNote(t.id);
        return false;
    }, this));
    tag.bind('click', {div: tag, tag: t}, _.bind(function(e) {//
        // log('Click on tag', t);
        if (this.selected != note) {
            return true;
        };
        if (e.shiftKey) {
            this.startTextEdit(this.selected.id, this.selected.div, 'tag', t.id);
            return false;
        };
        //e.data.div.siblings('.note_tag').find('.note_button').hide();
        //e.data.div.find('.note_button').show();
        // if (note.selectedTag == t && CURRENT_PLATFORM_MOBILE) {//Show menu
        //     new PopupMenu({
        //         element: this.root,
        //         items: [{
        //             caption: 'Select notes',
        //             handler: _.bind(function() {
        //                 this.proxy('openTag', null, [t.id]);
        //                 return true;
        //             }, this),
        //         }, {
        //             caption: 'Remove tag',
        //             handler: _.bind(function() {
        //                 this.proxy('removeTag', _.bind(function(id, err) {//
        //                     if (id) {
        //                         this.reload();
        //                     };
        //                 }, this), [note.id, t.id]);
        //                 return true;
        //             }, this),
        //         }, {
        //             caption: 'Create note',
        //             handler: _.bind(function() {
        //                 this.newNote(t.id);
        //                 return true;
        //             }, this),
        //         }]
        //     });
        // };
        log('Click tag:', t);
        note.selectedTag = t;
        note.div.find('.note_tag').removeClass('note_tag_selected');
        e.data.div.addClass('note_tag_selected');
        this.updated();
        if (e.ctrlKey) {
            this.proxy('openTag', null, [e.data.tag.id]);
        };
        return false;
    }, this));
    tag.bind('dragstart', {tag: t}, _.bind(function(e) {//
        dd.setDDTarget(e, tagDDType, e.data.tag.id);
        e.stopPropagation();
        return true;
    }, this));
    this.enableNoteDrop(tag, _.bind(function(n) {
        if (n.id) {//Add this tag to note
            this.proxy('addTag', _.bind(function(id, err) {//
                if (id) {
                    this.reload();
                };
            }, this), [n.id, t.id]);
        } else {//Create note with tag
            this.proxy('putNote', _.bind(function(id, err) {
                if (id) {
                    this.proxy('addTag', _.bind(function(id, err) {//
                        if (id) {
                            this.reload();
                        };
                    }, this), [id, t.id]);
                };
            }, this), [n]);
        };
    }, this))
    //tag.bind('dragenter', _.bind(function(e) {
        //log('tag drag enter', dd.hasDDTarget(e, tagDDType));
        //if (dd.hasDDTarget(e, tagDDType)) {
            //e.preventDefault();
        //};
    //}, this));
    this.enableTagDrop(tag, _.bind(function(tag, text) {
        this.proxy('addTag', _.bind(function(id, err) {//
            if (id) {
                this.reload(id);
            };
        }, this), [note.id, t.id, tag]);
    }, this));
    // tag.bind('dragover', _.bind(function(e) {
    //     //log('tag drag over', dd.hasDDTarget(e, tagDDType));
    //     if (dd.hasDDTarget(e, tagDDType)) {
    //         e.preventDefault();
    //     };
    // }, this));
    // tag.bind('drop', {note: note, tag: t}, _.bind(function(e) {
    //     var drop = dd.getDDTarget(e, tagDDType);
    //     if (drop) {
    //         this.proxy('addTag', _.bind(function(id, err) {//
    //             if (id) {
    //                 this.reload();
    //             };
    //         }, this), [e.data.note.id, e.data.tag.id, drop]);
    //         e.stopPropagation();
    //         e.preventDefault();
    //         return false;
    //     };
    // }, this));
};

Sheet.prototype.editNote = function(note, div) {
    if (this.launchTagMethod(note, 'edit_note', null)) {
        _showInfo('External editor is used')
        return;
    };
    this.editID = note.id;
    this.areaPanel.detach().insertAfter(div);
    this.areaPanel.show();
    this.editing = true;
    this.area.val(note.text || '').focus();
    this.updated();
};

Sheet.prototype.enableTagDrop = function(div, handler, id) {//Called when tag dropped
    div.bind('dragover', _.bind(function(e) {
        ctrlKey = e.ctrlKey;
        if (dd.hasDDTarget(e, tagDDType)) {
            e.preventDefault();
        };
        if (dd.hasDDTarget(e, 'text/uri-list')) {
            e.preventDefault();
        };
    }, this)).bind('drop', _.bind(function(e) {//Dropped
        log('Enable tag drop');
        var drop = dd.getDDTarget(e, 'text/uri-list');
        if (drop) {//URL - new note
            var text = dd.getDDTarget(e, 'text/html');
            if (text) {
                text = $(text).text();
            };
            if (!text) {
                text = dd.getDDTarget(e, 'text/plain') || drop;
            };
            handler('l:'+drop, text);
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
        var drop = dd.getDDTarget(e, tagDDType);
        if (drop) {
            handler(drop);
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
    }, this));
};

Sheet.prototype.enableNoteDrop = function(div, handler, id, special_drop_handler) {//Called when note or text is dropped
    var filesDD = 'application/x-vnd.adobe.air.file-list';
    var ctrlKey = false;
    div.bind('dragover', _.bind(function(e) {
        ctrlKey = e.ctrlKey;
        if (dd.hasDDTarget(e, noteDDType)) {
            e.preventDefault();
        };
        if (dd.hasDDTarget(e, filesDD)) {
            e.preventDefault();
        };
    }, this)).bind('drop', _.bind(function(e) {//Dropped
        log('Enable note drop');
        var drop = dd.getDDTarget(e, noteDDType);
        if (drop) {//Only ID - note drop
            // log('Dropped note', drop);
            handler({id: drop});
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
        drop = dd.getDDTarget(e, filesDD);
        if (drop) {//URL - new note
            //log('Drop file', e.ctrlKey, e.shiftKey, ctrlKey, e.originalEvent.dataTransfer.dropEffect);
            // if (ctrlKey) {//Copy links
            //     for (var i = 0; i < drop.length; i++) {//Copy and create file
            //         var f = drop[i];
            //         log('Dropped file link', f.nativePath);
            //         handler({text: f.name, link: f.nativePath});
            //     };
            // } else {//Copy files
            //     var files = this.proxy('copyFile', drop);
            //     if (!files) {
            //         log('File copy error');
            //         return false;
            //     };
            //     for (var i = 0; i < files.length; i++) {//
            //         log('Dropped file storage', files[i].text);
            //         handler(files[i]);
            //     };
            // };
            if (drop.length == 1) {
                this.proxy('createAttachment', _.bind(function (err) {
                    this.reload(id);
                }, this), [id, drop[0].nativePath]);
            };
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
        drop = dd.getDDTarget(e, 'text/html');
        if (drop) {
            drop = $(drop).text();
        };
        if (drop) {
            drop = dd.getDDTarget(e, 'text/plain');
        };
        if (drop && _.trim(drop)) {
            log('Dropped text', drop);
            handler({text: _.trim(drop)});
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
    }, this));
};

Sheet.prototype.openNote = function(note, inline) {
    var sort = '';
    for (var i = 0; i < note.tags.length; i++) {
        var tag = note.tags[i];
        if (_.startsWith(tag, 'sort:')) {
            sort = tag.substr('sort:'.length);
        };
    };
    if (inline) {
        if (!note.inline_notes) {
            var div = $(document.createElement('div')).addClass('note_inline_notes').appendTo(note.div);
            $(document.createElement('div')).addClass('clear').appendTo(div);
            note.inline_notes = div;
            this.proxy('loadNotes', _.bind(function(list, err) {//
                // log('Notes loaded:', list, err);
                if (list) {//Display list
                    for (var i = 0; i < list.length; i++) {//
                        log('Show note', list[i]);
                        this.showNote(list[i], div, false);
                    };
                    this.updated();
                };
            }, this), ['n:!'+note.id, sort || 'd* t*']);
        } else {
            note.inline_notes.remove();
            note.inline_notes = null;
        };
        return;
    };
    // log('openNote', note, sort);
    this.proxy('openTag', null, ['n:'+note.id, sort]);
};

Sheet.prototype.showNote = function(note, parent, lastSelected) {//
    var div = $('<div/>').addClass('note draggable').insertBefore(parent.children('.clear'));
    
    var now = new Date();
    var dt = new Date(note.created || now.getTime());
    var afterStr = [dt.format('m/d'+(now.getFullYear() != dt.getFullYear()? '/yy': '')+' h:MMt')];
    this.launchTagMethod(note, 'build_after', null, afterStr);
    div.attr('data-content', afterStr.join('/'));
    
    applyColor(div, note.color, false);
    note.div = div;
    div.bind('dblclick', {note: note, div: div}, _.bind(function(e) {
        this.editNote(note, div);
        e.preventDefault();
        return false;
    }, this));
    div.bind('click', {div: div}, _.bind(function(e) {//
        if (e.ctrlKey) {//Open tag
            this.openNote(note);
            return false;
        };
        // log('Note', note);
        this.areaPanel.hide();
        this.textPanel.hide();
        this.editing = false;
        this.root.find('.note').removeClass('note_selected');
        this.selectNote(note);
        return false;
    }, this));
    // div.bind('dragover', {note: note}, _.bind(function(e) {
    //     if (dd.hasDDTarget(e, tagDDType)) {
    //         e.preventDefault();
    //     };
    //     //if (dd.hasDDTarget(e, noteDDType)) {
    //         //e.preventDefault();
    //     //};
    // }, this));
    this.enableTagDrop(div, _.bind(function(tag, text) {
        this.proxy('addTag', _.bind(function(id, err) {//
            if (id) {
                this.reload(note.id);
            };
        }, this), [note.id, tag]);
    }, this));
    this.enableNoteDrop(div, _.bind(function(n) {
        if (n.id) {//
            this.proxy('addTag', _.bind(function(id, err) {//
                if (id) {
                    this.reload();
                };
            }, this), [note.id, 'n:'+n.id]);
        } else {//put note and add tag
            this.proxy('putNote', _.bind(function(id, err) {
                if (id) {
                    this.proxy('addTag', _.bind(function(id, err) {//
                        if (id) {
                            this.reload();
                        };
                    }, this), [note.id, 'n:'+id]);
                };
            }, this), [n]);
        };
    }, this), note.id);
    div.bind('dragstart', {note: note}, _.bind(function(e) {//
        dd.setDDTarget(e, noteDDType, e.data.note.id);
        e.stopPropagation();
        return true;
    }, this));
    var tags = $('<div/>').addClass('note_tags');
    if (note.subnotes>1) {
        $(ui.buildIcon('ic_notes')).appendTo(tags).addClass('left_icon').bind('click', {note: note, div: div}, _.bind(function(e) {//Add tag
            this.openNote(note, e.ctrlKey);
            return false;
        }, this));
    }
    $('<div style="clear: both;"/>').appendTo(div);
    var text = $('<div/>').addClass('note_text').appendTo(div);
    var lines = note.parsed || [''];
    if (!this.launchTagMethod(note, 'show_note', null, text, lines)) {
        for (var j = 0; j < lines.length; j++) {//Add lines
            var line = lines[j];
            var line_div = $('<div/>').addClass('note_line').appendTo(text);
            this.renderLine(note, line, line_div);
            // if (line.length == 0) {//Add text
            //     line_div.text('-');
            // };
            // if (j == 0) {//Prepend link
            //     tags.appendTo(line_div);
            //     // if (note.link) {
            //     //     $(_buildIcon('link_button')).addClass('left_icon').appendTo(line_div).bind('click', _.bind(function(e) {
            //     //         this.proxy('openLink', _.bind(function(res) {
            //     //         }, this), [note.link, e.ctrlKey]);
            //     //         return false;
            //     //     }, this));
            //     // };
            // };
        };        
    };
    text.children().eq(0).prepend(tags);
    if (note.display) {
        var displays = note.display.split(' ');
        for (var i = 0; i < displays.length; i++) {
            var disp = displays[i];
            if (disp == 'none') {//Hide lines
                text.find('.note_line').addClass('note_line_hide');
                div.addClass('note_bottom_bg');
            };
            if (disp== 'notags') {//Hide tags
                tags.addClass('note_line_hide');
            };
            if (disp == 'title') {//Hide all except first line
                text.find('.note_line').not(text.find('.note_line').first()).addClass('note_line_hide');
                div.addClass('note_bottom_bg');
            };        
            if (disp == 'short') {//Small note
                div.addClass('note_short');
            };        
        };
    };
    for (var j = 0; j < note.tags_captions.length; j++) {//Display tags
        var t = _.clone(note.tags_captions[j]);
        this.showTag(note, t, tags, true);

    };
    if (lastSelected) {
        this.selectNote(note);
    };
    $('<div style="clear: both;"/>').appendTo(tags);
    $('<div style="clear: both;"/>').appendTo(div);
    return div;
};

Sheet.prototype.renderLine = function(note, line, line_div) {
    for (var k = 0; k < line.length; k++) {//Add words
        var word = line[k];
        if (word.type == 'text') {//Add word
            $('<div/>').addClass('note_word').appendTo(line_div).text(word.text);
        } else if (word.type == 'checkbox') {
            var cbox = $(ui.buildIcon(word.checked? 'ic_check_yes': 'ic_check_no')).appendTo(line_div).css('float', 'left');
            cbox.bind('click', {note: note, box: word}, _.bind(function(e) {
                var new_text = e.data.note.text.substr(0, e.data.box.at)+(e.data.box.checked? '[ ]': '[X]')+e.data.note.text.substr(e.data.box.at+3);
                this.proxy('editNoteField', _.bind(function(id, err) {//
                    if (id) {
                        this.reload(id);
                    };
                }, this), [e.data.note.id, new_text]);
                return false;
            }, this));
            $('<div/>').addClass('note_word').appendTo(line_div).text(' ');
        } else if (word.type == 'tag') {//Add tag
            this.showTag(note, word.tag, line_div);
            $('<div/>').addClass('note_word').appendTo(line_div).text(' ');
        } else if (word.type == 'link') {//Add link
            var anchor = $(document.createElement('a')).addClass('note_link').attr('href', word.link).appendTo(line_div).text(word.text);
            anchor.bind('click', word, _.bind(function (e) {
                this.proxy('openLink', _.bind(function(res) {
                }, this), [e.data.link, e.ctrlKey]);
                return false;
            }, this))
            $('<div/>').addClass('note_word').appendTo(line_div).text(' ');
        };
    };
    $('<div style="clear: both;"/>').appendTo(line_div);
    
};

Sheet.prototype.reload_default = function(list, beforeID) {//
    this.root.children('.note').remove();
    for (var i = 0; i < list.length; i++) {//
        this.showNote(list[i], this.root, list[i].id == beforeID);
    };
    this.updated();
};

Sheet.prototype.render_hour = function(hour, div) {
    this.enableTagDrop(div, _.bind(function(tag, text) {
        this.proxy('createNote', _.bind(function(id, err) {//
            if (id) {
                this.reload(id);
            };
        }, this), [text || null, this.autotags+' '+tag+' t:'+(hour*100)]);
    }, this));    
};

Sheet.prototype._prepare_days = function(dstart, dend) {
    this.days = [];
    this.daystart = dstart;
    this.noDays = $(document.createElement('div')).addClass('no_days').appendTo(this.root);

};

Sheet.prototype.prepare_week = function() {
    //Create divs
    var dinfo = this.proxy('tagInfo', null, [this.data.tags]);
    log('dinfo', dinfo, this.data.tags);
    if (dinfo) {
        this._prepare_days(dinfo.dstart, dinfo.dend);
    };
};

// Sheet.prototype.reload_week = function(list, beforeID) {//
// };

Sheet.prototype.reload_day = function(list, beforeID) {//
    this.startHour = 0;
    this.endHour = 23;
    if (!this.hours) {//Create hours
        this.hours = [];
        this.noHour = $('<div/>').appendTo(this.root);
        $(document.createElement('div')).addClass('clear').appendTo(this.noHour);
        for (var i = this.startHour; i <= this.endHour; i++) {//Create divs
            var hr = $('<div/>').addClass('day_hour').appendTo(this.root);
            $('<div/>').addClass('day_hour_caption').appendTo(hr).text(''+(i>12? i-12: i)+(i>11? 'p': 'a'));
            this.hours[i] = hr;
            var notes_place = $('<div/>').addClass('day_hour_notes').appendTo(hr);
            $(document.createElement('div')).addClass('clear').appendTo(notes_place);
            if (CURRENT_PLATFORM_MOBILE) {
                installSwipeHandler(hr, _.bind(function(hour) {//
                    this.newNote('t:'+(hour*100));
                    return false;
                }, this), i);
            };
            this.render_hour(i, hr);
            hr.bind('dragover', _.bind(function(e) {
                if (dd.hasDDTarget(e, timeDDType)) {
                    e.preventDefault();
                };
            }, this)).bind('drop', {hour: i},  _.bind(function(e) {//Dropped
                var drop = dd.getDDTarget(e, timeDDType);
                if (drop && this.selected) {//Only ID - note drop
                    // log('Dropped time', drop);
                    this.proxy('moveNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload(id);
                        };
                    }, this), [this.selected.id, '-t:* t:'+(drop*100)+'-'+(e.data.hour*100)]);
                    e.stopPropagation();
                    e.preventDefault();
                    return false;
                };
            }, this));
            this.enableNoteDrop(hr, _.bind(function(n) {
                if (n.id) {//Note
                    this.instance.proxy('moveNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload();
                        };
                    }, this.instance), [n.id, this.instance.data.autotags+' -t:* t:'+(this.hour*100)]);
                } else {
                    this.instance.proxy('putNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload();
                        };
                    }, this.instance), [n, this.instance.data.autotags+' t:'+(this.hour*100)]);
                };
            }, {instance: this, hour: i}));
            hr.bind('dblclick', {hour: i}, _.bind(function(e) {
                this.newNote('t:'+(e.data.hour*100));
                e.preventDefault();
                return false;
            }, this));
            hr.bind('click', _.bind(function(e) {//
                if (this.editing) {//
                    return true;
                };
                this.areaPanel.hide();
                this.textPanel.hide();
                this.editing = false;
                this.unselectNote();
            }, this));
        };
        this.nowLine = $('<div/>').appendTo(this.root).addClass('now_line');
        if (this.moveNowLineID) {
            cancelInterval(this.moveNowLineID);
        };
        if (!CURRENT_PLATFORM_MOBILE) {
            this.moveNowLineID = setInterval(_.bind(this.moveNowLine, this), 3*60*1000);
        };
    } else {
        for (var i = this.hours.length-1; i >=0 ; i--) {
            var hr = this.hours[i];
            hr.detach().insertAfter(this.noHour);
        };
        this.root.find('.note').remove();
    };
    var hrPlaces = [];
    for (var i = this.startHour; i <= this.endHour; i++) {
        hrPlaces.push(null);
    };
    for (var i = 0; i < list.length; i++) {//
        var target = this.hours[list[i].hour];
        // target? target.children('.day_hour_notes'): 
        var div = this.showNote(list[i], this.noHour, list[i].id == beforeID);
        if (target) {
            var timeDown = $(ui.buildIcon('ic_time_down')).addClass('note_time_down');
            div.find('.note_tags').prepend(timeDown);
            timeDown.addClass('draggable').attr('draggable', 'true').bind('dragstart', {hour: list[i].hour}, _.bind(function(e) {//
                dd.setDDTarget(e, timeDDType, e.data.hour);
                e.stopPropagation();
                return true;
            }, this));
        };
        if (!list[i].hours) {
            if (target) {
                div.detach().insertBefore(target.children('.day_hour_notes').children('.clear'));
            };
        } else {
            var hstart = list[i].hours[0];
            var hend = list[i].hours[1];
            var hrsPlace = $(document.createElement('div')).addClass('note_inline_hours').appendTo(div);
            if (!hrPlaces[hstart]) {
                //Not detached
                div.detach().insertBefore(this.hours[hstart]);
            } else {
                div.detach().insertAfter(hrPlaces[hstart]);
            }
            for (var j = hstart; j <= hend; j++) {
                this.hours[j].detach().appendTo(hrsPlace);
                hrPlaces[j] = div;
            };
        }
    };
    this.moveNowLine();
    this.updated();
};

Sheet.prototype.moveNowLine = function() {//Moves now line
    if (!this.hours) {
        return;
    };
    var dt = new Date();
    var div = this.hours[dt.getHours()];
    if (div) {
        div.prepend(this.nowLine);
        var h = Math.floor(div.height()*dt.getMinutes()/60);
        this.nowLine.css('top', h).show();
    } else {
        this.nowLine.hide();
    };
};

Sheet.prototype.reload = function(beforeID) {//Asks for items
    this.areaPanel.hide();
    this.textPanel.hide();
    this.menu.element.hide();
    this.editing = false;
    this.selected = null;
    var tags = this.data.tags || '';
    var sort = this.data.sort || '';
    if (this.data.id) {
        tags = 's:'+this.data.id+'|'+tags;
        if (!sort) {
            sort = 's:'+this.data.id;
        };
    };
    this.proxy('loadNotes', _.bind(function(list, err) {//
        if (list) {//Display list
            var mode = this.data.display || 'default';
            if (this['reload_'+mode]) {//Have reload
                this['reload_'+mode].call(this, list, beforeID);
            };
        };
    }, this), [tags, sort]);
};

Sheet.prototype.startTextEdit = function(id, note, field, value) {//Shows editor
    this.editing = true;
    this.textPanel.detach().insertAfter(note);
    this.textPanel.show();
    this.text.val(value || '').focus();
    this.editID = id;
    this.editField = field;
    this.editValue = value;
    this.updated();
};

Sheet.prototype.newNote = function(tags) {//Starts new note
    this.editing = true;
    this.newTags = tags;
    this.root.prepend(this.areaPanel.detach());
    this.areaPanel.show();
    this.area.val('').focus();
    this.editID = null;
    this.updated();
};

Sheet.prototype.updated = function() {//Empty
};

Sheet.prototype.close = function(handler) {
    if (!this.data.id) {//No ID
        handler();
    } else {//
        this.proxy('closeSheet', _.bind(function(id) {
            handler();
        }, this), [this.data.id]);
    };
};

Sheet.prototype.move = function(x, y) {
    if (this.data.id) {//ID
        this.data.x = x;
        this.data.y = y;
        this.proxy('moveSheet', _.bind(function(id, err) {
        }, this), [this.data.id, x, y]);
    };
};
