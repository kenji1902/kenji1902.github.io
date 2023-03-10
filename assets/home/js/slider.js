$(document).ready(function () {
    const container = $(".slideContainer")[0];
    $("#slider").on('input change', function () {
        container.style.setProperty('--position', `${this.value}%`);
        console.log(this.value)
    });
    
    
});

