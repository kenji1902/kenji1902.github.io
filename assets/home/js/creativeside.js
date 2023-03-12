$(document).ready(function () {
    $(".tz-gallery .lightbox").hover(function () {
            // over
            $(".tz-gallery .lightbox").addClass("darken");
            $(this).removeClass("darken");
            $(this).children("img").addClass('shadow-pop-bl');
        }, function () {
            // out
            $(".tz-gallery .lightbox").removeClass("darken");
            $(this).children("img").removeClass('shadow-pop-bl');
        }
    );
});