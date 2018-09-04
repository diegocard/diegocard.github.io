function changeAccessLevel() {
    var newValue = $("#accessLevel").val();
    if (newValue === "admin") {
        $("#containerDiv").hide();
    } else {
        $("#containerDiv").show();
    }
}

$(function () {

    
    // ------------------------------------------------------- //
    // Datatables
    // ------------------------------------------------------ //    

    $("#sectionAccess").hide()
    
    $("#btnInsights").click(function() {
        $("#sectionInsights").show()
        $("#sectionAccess").hide()
        $("#btnInsights").toggleClass("wt-active");
        $("#btnAccess").toggleClass("wt-active");
    });

    $("#btnAccess").click(function() {
        $("#sectionInsights").hide()
        $("#sectionAccess").show()
        $("#btnInsights").toggleClass("wt-active");
        $("#btnAccess").toggleClass("wt-active");
    });

    var authorizationJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NhbmRib3guYXV0aDAtZXh0ZW5kLmNvbSIsInN1YiI6ImRpZWdvY2FyZEBnbWFpbC5jb20iLCJhdWQiOiJteV9kZXBsb3ltZW50X2lkIn0.gwmoCngdwW58-ZXSbhrvvkask2tGpaAI2Hr8Wl04-es";

    // Draw the table
    $(document).ready(function () {
        Table = $('#accessTable').DataTable({
            pageLength: 5,
            ajax: {
                url: 'https://wt-350edaf6de1a9a1beb1ac87dc1fc39de-0.sandbox.auth0-extend.com/authorization/accessData',
                beforeSend: function(request) {
                    request.setRequestHeader("Authorization", "Bearer " + authorizationJWT);
                },
            }
        });


        // Create form
        $('#btnIssueAuth').click(function (event) {
            var userId = $("#userId").val();
            var accessLevel = $("#accessLevel").val();
            var container = $("#container").val();

            var newEntry = [
                userId,
                accessLevel,
                container
            ];

            $.ajax({
                method: 'POST',
                url:'https://wt-350edaf6de1a9a1beb1ac87dc1fc39de-0.sandbox.auth0-extend.com/authorization/issue',
                beforeSend: function(request) {
                    request.setRequestHeader("Authorization", "Bearer " + authorizationJWT);
                },
                cache:false,
                data: JSON.stringify(readInputData()),
                contentType: "application/json",
                complete: function (response, extra) {
                    if (response.status === 200) {
                        $('#output').addClass("ok");
                        $('#output').removeClass("error");
                        Table.row.add(newEntry).draw(false);
                    }

                    if (response.responseJSON && response.responseJSON.msg) {
                        $('#output').html(response.responseJSON.msg);
                        $('#output').removeClass("ok");
                        $('#output').addClass("error");
                    } else {
                        $('#output').html(response.responseText);
                    }
                    $('#output').fadeOut(250).fadeIn(250); 
                },
                error: function () {
                    $('#output').html('Forbidden');
                    $('#output').removeClass("ok");
                    $('#output').addClass("error");
                },
            });

            event.preventDefault();


        });

        $('#btnCheck').click(function () {
            var data = readInputData();
            var url = 'https://wt-350edaf6de1a9a1beb1ac87dc1fc39de-0.sandbox.auth0-extend.com/authorization/check?';
            url += "userId=" + data.user;
            url += "&scope=" + data.scope;
            
            $.ajax({
                method: 'GET',
                url: url,
                cache:false,
                beforeSend: function(request) {
                    request.setRequestHeader("Authorization", "Bearer " + authorizationJWT);
                },
                //contentType: "application/json",
                complete: function (response) {
                    $('#output').html(response.responseText);
                    if (response.status === 200) {
                        $('#output').addClass("ok");
                        $('#output').removeClass("error");
                    }
                    $('#output').fadeOut(250).fadeIn(250); 
                },
                error: function () {
                    $('#output').html('Opps. There was an error!');
                    $('#output').removeClass("ok");
                    $('#output').addClass("error");
                },
            });
            return false;
        });
    

        function readInputData() {
            var data = {
                user: $("#userId").val(),
                scope: "wt:" + $("#accessLevel").val()
            };
            if ($("#accessLevel").val() === "owner") {
                data.scope +=  ":" + $("#container").val();
            }
            return data;
        }
    });

    // ------------------------------------------------------- //
    // Tooltips init
    // ------------------------------------------------------ //    

    $('[data-toggle="tooltip"]').tooltip()        

    // ------------------------------------------------------- //
    // Universal Form Validation
    // ------------------------------------------------------ //

    $('.form-validate').each(function() {  
        $(this).validate({
            errorElement: "div",
            errorClass: 'is-invalid',
            validClass: 'is-valid',
            ignore: ':hidden:not(.summernote),.note-editable.card-block',
            errorPlacement: function (error, element) {
                // Add the `invalid-feedback` class to the error element
                error.addClass("invalid-feedback");
                //console.log(element);
                if (element.prop("type") === "checkbox") {
                    error.insertAfter(element.siblings("label"));
                } 
                else {
                    error.insertAfter(element);
                }
            }
        });
    });

    // ------------------------------------------------------- //
    // Material Inputs
    // ------------------------------------------------------ //

    var materialInputs = $('input.input-material');

    // activate labels for prefilled values
    materialInputs.filter(function() { return $(this).val() !== ""; }).siblings('.label-material').addClass('active');

    // move label on focus
    materialInputs.on('focus', function () {
        $(this).siblings('.label-material').addClass('active');
    });

    // remove/keep label on blur
    materialInputs.on('blur', function () {
        $(this).siblings('.label-material').removeClass('active');

        if ($(this).val() !== '') {
            $(this).siblings('.label-material').addClass('active');
        } else {
            $(this).siblings('.label-material').removeClass('active');
        }
    });

    // ------------------------------------------------------- //
    // Footer 
    // ------------------------------------------------------ //   

    var pageContent = $('.page-content');

    $(document).on('sidebarChanged', function () {
        adjustFooter();
    });

    $(window).on('resize', function(){
        adjustFooter();
    })

    function adjustFooter() {
        var footerBlockHeight = $('.footer__block').outerHeight();
        pageContent.css('padding-bottom', footerBlockHeight + 'px');
    }

    // ------------------------------------------------------- //
    // Adding fade effect to dropdowns
    // ------------------------------------------------------ //
    $('.dropdown').on('show.bs.dropdown', function () {
        $(this).find('.dropdown-menu').first().stop(true, true).fadeIn(100).addClass('active');
    });
    $('.dropdown').on('hide.bs.dropdown', function () {
        $(this).find('.dropdown-menu').first().stop(true, true).fadeOut(100).removeClass('active');
    });


    // ------------------------------------------------------- //
    // Search Popup
    // ------------------------------------------------------ //
    $('.search-open').on('click', function (e) {
        e.preventDefault();
        $('.search-panel').fadeIn(100);
    })
    $('.search-panel .close-btn').on('click', function () {
        $('.search-panel').fadeOut(100);
    });


    // ------------------------------------------------------- //
    // Sidebar Functionality
    // ------------------------------------------------------ //
    $('.sidebar-toggle').on('click', function () {
        $(this).toggleClass('active');

        $('#sidebar').toggleClass('shrinked');
        $('.page-content').toggleClass('active');
        $(document).trigger('sidebarChanged');

        if ($('.sidebar-toggle').hasClass('active')) {
            $('.navbar-brand .brand-sm').addClass('visible');
            $('.navbar-brand .brand-big').removeClass('visible');
            $(this).find('i').attr('class', 'fa fa-long-arrow-right');
        } else {
            $('.navbar-brand .brand-sm').removeClass('visible');
            $('.navbar-brand .brand-big').addClass('visible');
            $(this).find('i').attr('class', 'fa fa-long-arrow-left');
        }
    });



});