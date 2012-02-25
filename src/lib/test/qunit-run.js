var runOrTest = function(run, test, title) {//Run app or tests
    if (_.endsWith(document.location.toString(), '?test')) {//Run tests
        $(document.body).append($('<h1 id="qunit-header"/>').text(title || ''));
        $(document.body).append('<h2 id="qunit-banner"/>');
        $(document.body).append('<h2 id="qunit-userAgent"/>');
        $(document.body).append('<ol id="qunit-tests"/>');
        if (test) {
            test();
        };
    } else {//Normal run
        if (run) {
            run();
        };
    };
};
