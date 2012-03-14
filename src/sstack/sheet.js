var tagDDType = 'sstack/tag';
var noteDDType = 'sstack/note';

var _buildIcon = function(name, cl) {//Builds img html
    return '<div class="icon'+(cl? ' '+cl: '')+'" style="background-image: url(\'img/icons/'+name+'.png\');"/>';
};

var Sheet = function(sheet, element, proxy, menuPlace) {//
    this.data = sheet;
    this.root = element;
    this.proxy = proxy;
    this.menuPlace = menuPlace;
    this.areaPanel = $('<div/>').addClass('area_wrap').appendTo(this.root).hide();
    this.area = $('<textarea/>').addClass('form_control').appendTo(this.areaPanel);
    this.area.autoGrow(10);
    var menuDiv = $(document.createElement('div')).addClass('sheet_menu').appendTo(this.root).hide();
    this.menu = new Buttons({
        root: menuDiv,
        maxElements: 4,
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
            _showQuestion('Remove note?', _.bind(function (index) {
                if (0 == index) {
                    this.proxy('removeNote', _.bind(function(id, err) {//Removed
                        if (id) {
                            this.reload();
                        };
                    }, this), [this.selected.id]);
                };
            }, this))
            this.updated();
        }, this)
    });
    this.menu.addButton({
        caption: 'More',
        handler: _.bind(function() {//
            var items = [];
            if (this.selected.selectedTag) {
                items.push({
                    caption: 'Remove tag',
                    cls: 'button_remove',
                    handler: _.bind(function() {
                        _showQuestion('Remove tag?', _.bind(function (index) {
                            if (0 == index) {
                                this.proxy('removeTag', _.bind(function(id, err) {//
                                    if (id) {
                                        this.reload();
                                    };
                                }, this), [this.selected.id, this.selected.selectedTag.id]);
                            };
                        }, this))
                        this.updated();
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
            };
            items.push({
                caption: 'Link',
                cls: 'button_create',
                handler: _.bind(function() {
                    this.startTextEdit(this.selected.id, this.selected.div, 'link', this.selected.link);
                    return true;
                }, this),
            });
            items.push({
                caption: 'Open note',
                handler: _.bind(function() {
                    this.proxy('openTag', null, ['n:'+this.selected.id]);
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
    this.reload();
};

Sheet.prototype.launchTagMethod = function(note, method) {
    for (var j = 0; j < note.tags_captions.length; j++) {//Display tags
        var t = note.tags_captions[j];
        if (t.display) {
            var m = 'tag_'+method+'_'+t.display;
            if (this[m]) {
                this[m].call(this, note, t.id);
            };
        };
    };
};

Sheet.prototype.tag_unselect_geo = function(note, tag) {
    if (note.geoCreated) {
        note.div.find('.geo').remove();
        note.geoCreated = false;
    };
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
        log('Show file', tag);
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
                    var gap = 8;
                    var width = note.div.innerWidth()-2*gap;
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

Sheet.prototype.tag_select_geo = function(note, tag) {
    // log('Ready to show geo', tag);
    if (!note.geoCreated) {
        var arr = tag.split(':');
        var point = {};
        for (var i = 0; i < arr.length; i++) {
            var item = arr[i];
            var vp = item.split('=');
            if (vp.length == 2) {
                point[vp[0]] = vp[1];
            };
        };
        // log('Show point', point);
        note.geoCreated = true;
        if (point.lat && point.lon) {
            var gap = 8;
            var width = note.div.innerWidth()-2*gap;
            var height = 180;
            var frame = $(document.createElement('div')).addClass('geo note_frame note_line_hide').appendTo(note.div);
            var img = $(document.createElement('img')).addClass('geo_image note_image').appendTo(frame);
            img.attr('src', 'http://maps.google.com/maps/api/staticmap?center='+point.lat+','+point.lon+'&zoom=15&size='+width+'x'+height+'&sensor=true&markers=color:red|size:mid|'+point.lat+','+point.lon);
            img.width(width).height(height);
        };
    };
};

Sheet.prototype.editTextDone = function(val) {//Edit tag/link/ref
    var method = null;
    if (this.editField == 'tag') {
        method = 'addTag';
        val = _.trim((val || '').toLowerCase());
        this.proxy(method, _.bind(function(id, err) {//
            if (id) {
                this.reload();
            };
        }, this), [this.editID, val]);
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

Sheet.prototype.pointToTag = function(point, round) {
    var fixFloat = function (fl) {
        if (!fl) {
            return 0;
        };
        if (!round) {
            return fl;
        };
        return Math.round(fl*round)/round;
    };
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
                    var tags = this.data.autotags;
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
        }, this), [val, this.data.autotags+(this.newTags? ' '+this.newTags: '')]);
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
    note.div.after(this.menu.element.detach().show());
    note.selectedTag = null;
    this.root.find('.note_tag').removeClass('note_tag_selected');
    this.root.find('.note_line_show').removeClass('note_line_show');
    note.div.find('.note_line_hide').addClass('note_line_show');
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
    applyColor(tag, t.color, true);
    tag.text(t.caption);
    tag.bind('dblclick', {tag: t}, _.bind(function(e) {
        e.preventDefault();
        this.newNote(t.id);
        return false;
    }, this));
    tag.bind('click', {div: tag, tag: t}, _.bind(function(e) {//
        if (this.selected != note) {
            return true;
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
    tag.bind('dragover', _.bind(function(e) {
        //log('tag drag over', dd.hasDDTarget(e, tagDDType));
        if (dd.hasDDTarget(e, tagDDType)) {
            e.preventDefault();
        };
    }, this));
    tag.bind('drop', {note: note, tag: t}, _.bind(function(e) {
        var drop = dd.getDDTarget(e, tagDDType);
        if (drop) {
            this.proxy('addTag', _.bind(function(id, err) {//
                if (id) {
                    this.reload();
                };
            }, this), [e.data.note.id, e.data.tag.id, drop]);
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
    }, this));
};

Sheet.prototype.editNote = function(note, div) {
    this.editID = note.id;
    this.areaPanel.detach().insertAfter(div);
    this.areaPanel.show();
    this.editing = true;
    this.area.val(note.text || '').focus();
    this.updated();
};

Sheet.prototype.enableNoteDrop = function(div, handler, id) {//Called when note or text is dropped
    var filesDD = 'application/x-vnd.adobe.air.file-list';
    var ctrlKey = false;
    div.bind('dragover', _.bind(function(e) {
        ctrlKey = e.ctrlKey;
        if (dd.hasDDTarget(e, noteDDType)) {
            e.preventDefault();
        };
        if (dd.hasDDTarget(e, 'text/uri-list')) {
            e.preventDefault();
        };
        if (dd.hasDDTarget(e, filesDD)) {
            e.preventDefault();
        };
    }, this)).bind('drop', _.bind(function(e) {//Dropped
        var drop = dd.getDDTarget(e, noteDDType);
        if (drop) {//Only ID - note drop
            // log('Dropped note', drop);
            handler({id: drop});
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
        drop = dd.getDDTarget(e, 'text/uri-list');
        if (drop) {//URL - new note
            var text = dd.getDDTarget(e, 'text/html');
            if (text) {
                text = $(text).text();
            };
            if (!text) {
                text = dd.getDDTarget(e, 'text/plain') || drop;
            };
            log('Dropped link', text, drop);
            handler({text: text, link: drop});
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

Sheet.prototype.showNote = function(note, parent, lastSelected) {//
    var div = $('<div/>').addClass('note draggable').appendTo(parent);
    applyColor(div, note.color, false);
    note.div = div;
    div.bind('dblclick', {note: note, div: div}, _.bind(function(e) {
        this.editNote(note, div);
        e.preventDefault();
        return false;
    }, this));
    div.bind('click', {div: div}, _.bind(function(e) {//
        if (e.ctrlKey) {//Open tag
            this.proxy('openTag', null, ['n:'+note.id]);
            return false;
        };
        // log('Note', note);
        this.areaPanel.hide();
        this.textPanel.hide();
        this.editing = false;
        this.root.find('.note').removeClass('note_selected');
        div.addClass('note_selected');
        // if (this.selected == note && CURRENT_PLATFORM_MOBILE) {//Show menu
        //     var items = [{
        //         caption: 'Edit note',
        //         handler: _.bind(function() {//
        //             this.editNote(note, div);
        //             return true;
        //         }, this),
        //     }, {
        //         caption: 'Remove note',
        //         handler: _.bind(function() {
        //             this.proxy('removeNote', _.bind(function(id, err) {//Removed
        //                 if (id) {
        //                     this.reload();
        //                 };
        //             }, this), [note.id]);
        //             return true;
        //         }, this),
        //     }, {
        //         caption: 'Add tag',
        //         handler: _.bind(function() {
        //             this.startTextEdit(note.id, div, 'tag');
        //             return true;
        //         }, this),
        //     }];
        //     if (note.link) {
        //         items.push({
        //             caption: 'Open link',
        //             handler: _.bind(function() {
        //                 this.proxy('openLink', _.bind(function(res) {
        //                 }, this), [note.link]);
        //             }, this),
        //         });
        //     };
        //     new PopupMenu({
        //         element: this.root,
        //         items: items,
        //     });
        // };
        this.selectNote(note);
        return false;
    }, this));
    div.bind('dragover', {note: note}, _.bind(function(e) {
        if (dd.hasDDTarget(e, tagDDType)) {
            e.preventDefault();
        };
        //if (dd.hasDDTarget(e, noteDDType)) {
            //e.preventDefault();
        //};
    }, this));
    div.bind('drop', {note: note}, _.bind(function(e) {
        var drop = dd.getDDTarget(e, tagDDType);
        if (drop) {
            this.proxy('addTag', _.bind(function(id, err) {//
                if (id) {
                    this.reload();
                };
            }, this), [e.data.note.id, drop]);
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
        //var drop = dd.getDDTarget(e, noteDDType);
        //if (drop) {
            //this.proxy('addTag', _.bind(function(id, err) {//
                //if (id) {
                    //this.reload();
                //};
            //}, this), [e.data.note.id, 'n:'+drop]);
            //e.stopPropagation();
            //e.preventDefault();
            //return false;
        //};
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
    }, this));
    var tags = $('<div/>').addClass('note_tags');
    if (note.subnotes>1) {
        $(_buildIcon('notes')).appendTo(tags).addClass('left_icon').bind('click', {note: note, div: div}, _.bind(function(e) {//Add tag
            this.proxy('openTag', null, ['n:'+note.id]);
            return false;
        }, this));
    }
    // var menu = $('<div/>').addClass('note_menu note_line_hide').appendTo(div);
    // $(_buildIcon('tag')).addClass('note_button').appendTo(menu).bind('click', {note: note, div: div}, _.bind(function(e) {//Add tag
    //     this.startTextEdit(e.data.note.id, e.data.div, 'tag');
    //     return false;
    // }, this));
    // note.tagDelete = $(_buildIcon('tag_delete')).addClass('note_button').appendTo(menu).bind('click', {note: note, div: div}, _.bind(function(e) {//Add tag
    //     //Remove tag
    //     if (note.selectedTag) {
    //         this.proxy('removeTag', _.bind(function(id, err) {//
    //             if (id) {
    //                 this.reload();
    //             };
    //         }, this), [note.id, note.selectedTag.id]);
    //     };
    //     return false;
    // }, this)).hide();
    // $(_buildIcon('link')).addClass('note_button').appendTo(menu).bind('click', _.bind(function(e) {//Add tag
    //     this.startTextEdit(note.id, div, 'link', note.link);
    //     return false;
    // }, this));
    // $(_buildIcon('bin')).addClass('note_button').appendTo(menu).bind('click', {note: note}, _.bind(function(e) {//Delete
    //     this.proxy('removeNote', _.bind(function(id, err) {//Removed
    //         if (id) {
    //             this.reload();
    //         };
    //     }, this), [e.data.note.id]);
    //     return false;
    // }, this));
    $('<div style="clear: both;"/>').appendTo(div);
    var text = $('<div/>').addClass('note_text').appendTo(div);
    var lines = note.parsed || [''];
    for (var j = 0; j < lines.length; j++) {//Add lines
        var line = lines[j];
        var line_div = $('<div/>').addClass('note_line').appendTo(text);
        if (line.length == 0) {//Add text
            line_div.text('-');
        };
        if (j == 0) {//Prepend link
            tags.appendTo(line_div);
            if (note.link) {
                $(_buildIcon('link_button')).addClass('left_icon').appendTo(line_div).bind('click', _.bind(function(e) {
                    this.proxy('openLink', _.bind(function(res) {
                    }, this), [note.link, e.ctrlKey]);
                    return false;
                }, this));
            };
        };
        for (var k = 0; k < line.length; k++) {//Add words
            var word = line[k];
            if (word.type == 'text') {//Add word
                $('<div/>').addClass('note_word').appendTo(line_div).text(word.text);
            } else if (word.type == 'checkbox') {
                var cbox = $(_buildIcon(word.checked? 'check_yes': 'check_no')).appendTo(line_div).css('float', 'left');
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
            };
        };
        $('<div style="clear: both;"/>').appendTo(line_div);
    };
    if (note.display == 'none') {//Hide lines
        text.find('.note_line').addClass('note_line_hide');
    };
    if (note.display == 'notags') {//Hide tags
        tags.addClass('note_line_hide');
    };
    if (note.display == 'title') {//Hide all except first line
        text.find('.note_line').not(text.find('.note_line').first()).addClass('note_line_hide');
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
};

Sheet.prototype.reload_default = function(list, beforeID) {//
    this.root.children('.note').remove();
    for (var i = 0; i < list.length; i++) {//
        this.showNote(list[i], this.root, list[i].id == beforeID);
    };
    this.updated();
};

Sheet.prototype.reload_day = function(list, beforeID) {//
    this.startHour = 0;
    this.endHour = 23;
    this.root.find('.note').remove();
    if (!this.hours) {//Create hours
        this.hours = [];
        this.noHour = $('<div/>').appendTo(this.root);
        for (var i = this.startHour; i <= this.endHour; i++) {//Create divs
            var hr = $('<div/>').addClass('day_hour').appendTo(this.root);
            $('<div/>').addClass('day_hour_caption').appendTo(hr).text(''+(i>12? i-12: i)+(i>11? 'p': 'a'));
            this.hours[i] = hr;
            $('<div/>').addClass('day_hour_notes').appendTo(hr);
            if (CURRENT_PLATFORM_MOBILE) {
                installSwipeHandler(hr, _.bind(function(hour) {//
                    this.newNote('t:'+(hour*100));
                    return false;
                }, this), i);
            };
            hr.bind('dragover', _.bind(function(e) {
                if (dd.hasDDTarget(e, tagDDType)) {
                    e.preventDefault();
                };
                //if (dd.hasDDTarget(e, noteDDType)) {
                    //e.preventDefault();
                //};
            }, this));
            hr.bind('drop', {hour: i}, _.bind(function(e) {
                var drop = dd.getDDTarget(e, tagDDType);
                if (drop) {
                    //this.newNote(drop+' t:'+(e.data.hour*100));
                    this.proxy('createNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload();
                        };
                    }, this), [null, this.data.autotags+' '+drop+' t:'+(e.data.hour*100)]);
                    e.stopPropagation();
                    e.preventDefault();
                    return false;
                };
                //drop = dd.getDDTarget(e, noteDDType);
                //if (drop) {
                    //this.proxy('moveNote', _.bind(function(id, err) {//
                        //if (id) {
                            //this.reload();
                        //};
                    //}, this), [drop, this.data.autotags+' -t:* t:'+(e.data.hour*100)]);
                    //e.stopPropagation();
                    //e.preventDefault();
                    //return false;
                //};
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
        setInterval(_.bind(this.moveNowLine, this), 60*1000);
    };
    for (var i = 0; i < list.length; i++) {//
        var target = this.hours[list[i].hour];
        this.showNote(list[i], target? target.children('.day_hour_notes'): this.noHour, list[i].id == beforeID);
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
    this.proxy('loadNotes', _.bind(function(list, err) {//
        if (list) {//Display list
            var mode = this.data.display || 'default';
            if (this['reload_'+mode]) {//Have reload
                this['reload_'+mode].call(this, list, beforeID);
            };
        };
    }, this), [this.data.tags, this.data.sort]);
};

Sheet.prototype.startTextEdit = function(id, note, field, value) {//Shows editor
    this.editing = true;
    this.textPanel.detach().insertAfter(note);
    this.textPanel.show();
    this.text.val(value || '').focus();
    this.editID = id;
    this.editField = field;
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
