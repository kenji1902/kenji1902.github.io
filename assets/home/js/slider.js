$(document).ready(function () {
    const container = $(".slideContainer")[0];
    $("#slider").on('input change', function () {
        let sliderVal = this.value;
        container.style.setProperty('--position', `${sliderVal}%`);
        console.log(this.value)

        
        //Creative Side
        if(sliderVal <= 35){
            $(".RcenterText").removeClass("none");
            $(".RcenterText").addClass("slide-in-left");
            $(".rightText").removeClass("slide-in-right");
            $(".rightText").addClass("slide-out-right");
        }
        else{
            $(".RcenterText").removeClass("slide-in-left");
            $(".RcenterText").addClass("slide-out-left");
            $(".rightText").removeClass("slide-out-right");
            $(".rightText").addClass("slide-in-right");
        }

        //Developer Side
        if(sliderVal >= 65){
            $(".LcenterText").removeClass("none");
            $(".LcenterText").addClass("slide-in-right");
            $(".leftText").removeClass("slide-in-left");
            $(".leftText").addClass("slide-out-left");
        }
        else{
            $(".LcenterText").removeClass("slide-in-right");
            $(".LcenterText").addClass("slide-out-right");
            $(".leftText").removeClass("slide-out-left");
            $(".leftText").addClass("slide-in-left");
        }

    });
    
    
});

