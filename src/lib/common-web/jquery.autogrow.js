/*!
 * Autogrow Textarea Plugin Version v2.0
 * http://www.technoreply.com/autogrow-textarea-plugin-version-2-0
 *
 * Copyright 2011, Jevin O. Sewaruth
 *
 * Date: March 13, 2011
 */
jQuery.fn.autoGrow = function(max){
    return this.each(function(){
        // Variables
        var colsDefault = this.cols;
        var rowsDefault = this.rows;
        
        //Functions
        var grow = function() {
            growByRef(this);
        }
        
        var growByRef = function(obj) {
            var linesCount = 0;
            var lines = obj.value.split('\n');
            
            for (var i=lines.length-1; i>=0; --i)
            {
                linesCount += Math.floor((lines[i].length / obj.cols) + 1);
            }

            if (linesCount <= max)
                obj.rows = linesCount + 1;
            else
                obj.rows = max+1;
        }
        
        var characterWidth = function (obj){
            var characterWidth = 0;
            var temp1 = 0;
            var temp2 = 0;
            var tempCols = obj.cols;
            
            obj.cols = 1;
            temp1 = obj.offsetWidth;
            obj.cols = 2;
            temp2 = obj.offsetWidth;
            characterWidth = temp2 - temp1;
            obj.cols = tempCols;
            
            return characterWidth;
        }
        
        this.onkeyup = grow;
        this.onfocus = grow;
        this.onblur = grow;
        growByRef(this);
    });
};

