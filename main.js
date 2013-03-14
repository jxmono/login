define(["/jquery.min.js"], function() {

    var self;
    var form;
    var config;

    function init(conf) {

        self = this;
        config = conf;

        // TODO process options as function
        config.successPage = config.successPage || "/";

        // cache the form and add the submit handler
        form = $(self.dom).find("form").first();
        form.submit(function() {
            submitForm();
            return false;
        });
    }

    function submitForm() {

        // hide and empty the error message
        form.find(".alert").text("").hide();

        // does the user want to be remembered
        var remember = false;
        var checkbox = form.find("input[name='remember']").get(0);
        if (checkbox) {
            remember = checkbox.checked;
        }

        // prepare the data for the operation
        var data = {
            username: form.find("input[name='username']").val(),
            password: form.find("input[name='password']").val(),
            remember: remember
        };

        // call the operation
        self.link("login", { data: data }, function(err, data) {

            if (err) {
                form.find(".alert").text(err).fadeIn();
                return;
            }

            window.location = config.successPage;
        });
    }

    return init;
});

