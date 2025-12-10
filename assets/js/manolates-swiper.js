document.addEventListener("DOMContentLoaded", function() {
    var swiper = new Swiper(".manolates-swiper", {
        slidesPerView: 1,
        spaceBetween: 30,
        loop: true,
        
        autoplay: {
            delay: 3000,
            disableOnInteraction: false,
        },
        
        pagination: {
            el: ".swiper-pagination",
            clickable: true,
        },
    });
});