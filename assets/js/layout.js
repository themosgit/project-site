document.addEventListener('DOMContentLoaded', () => {
    const isInPagesFolder = window.location.pathname.includes('/pages/');

    const rootPath = isInPagesFolder ? '../' : '';
    
    const pagesPath = isInPagesFolder ? '' : 'pages/';

    const navLinks = `
        <a href="${rootPath}index.html" class="text-gray-900 font-semibold px-3 py-2 rounded-md hover:bg-gray-100 block transition-colors">Home</a>
        <a href="${pagesPath}part1.html" class="text-gray-500 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium block transition-colors">Part 1</a>
        <a href="${pagesPath}part2.html" class="text-gray-500 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium block transition-colors">Part 2</a>
    `;

    const headerHtml = `
        <nav class="bg-white shadow-md fixed top-0 left-0 w-full z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <a href="${rootPath}index.html" class="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M12 20q.45 0 .863-.05t.837-.15L12.5 18H9v-1q0-.825.588-1.412T11 15h2v-3h-2q-.425 0-.712-.288T10 11V9h-.45q-.65 0-1.1-.437T8 7.475q0-.225.063-.45T8.25 6.6L9.8 4.325Q7.275 5.05 5.637 7.15T4 12h1v-1q0-.425.288-.712T6 10h2q.425 0 .713.288T9 11v1q0 .425-.288.713T8 13v1q0 .825-.587 1.413T6 16h-.925q1.05 1.8 2.875 2.9T12 20m7.6-5.55q.2-.575.3-1.187T20 12q0-2.8-1.7-4.937T14 4.25V7q.825 0 1.413.588T16 9v2q.475 0 .85.113t.725.462zM12.003 21q-1.866 0-3.51-.708q-1.643-.709-2.859-1.924t-1.925-2.856T3 12.003t.709-3.51Q4.417 6.85 5.63 5.634t2.857-1.925T11.997 3t3.51.709q1.643.708 2.859 1.922t1.925 2.857t.709 3.509t-.708 3.51t-1.924 2.859t-2.856 1.925t-3.509.709"/></svg>
                            Manolates
                        </a>
                    </div>

                    <!-- Desktop Menu -->
                    <div class="hidden md:flex items-center space-x-4">
                        ${navLinks.replace(/block/g, '')} 
                    </div>

                    <!-- Mobile Hamburger Button -->
                    <div class="flex items-center md:hidden">
                        <button id="mobile-menu-btn" class="text-gray-600 hover:text-gray-900 focus:outline-none p-2">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Mobile Drawer Overlay -->
            <div id="mobile-drawer-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden transition-opacity duration-300 opacity-0"></div>

            <!-- Mobile Drawer -->
            <div id="mobile-drawer" class="fixed inset-y-0 right-0 w-64 bg-white shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col">
                
                <!-- Drawer Header -->
                <div class="flex items-center justify-between p-4 border-b">
                    <span class="font-bold text-gray-800 text-lg">Menu</span>
                    <button id="close-drawer-btn" class="text-gray-500 hover:text-gray-800 focus:outline-none">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <!-- Drawer Links -->
                <div class="flex flex-col p-4 space-y-2">
                    ${navLinks}
                </div>
            </div>
        </nav>
    `;

    const footerHtml = `
        <footer class="bg-gray-800 text-white mt-auto">
            <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <div class="flex flex-col items-center justify-center">
                    <p class="text-sm text-gray-300">© 2025 Benchmark Analysis Tool</p>
                    <p class="text-md font-semibold mt-2 text-blue-400">Made by manolates-team</p>
                </div>
            </div>
        </footer>
    `;

    document.body.insertAdjacentHTML('afterbegin', headerHtml);
    
    document.body.classList.add('pt-16');

    // Inject Footer
    document.body.insertAdjacentHTML('beforeend', footerHtml);

    const menuBtn = document.getElementById('mobile-menu-btn');
    const closeBtn = document.getElementById('close-drawer-btn');
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('mobile-drawer-overlay');

    if (menuBtn && closeBtn && drawer && overlay) {
        function openMenu() {
            overlay.classList.remove('hidden');
            void overlay.offsetWidth; 
            overlay.classList.remove('opacity-0');
            drawer.classList.remove('translate-x-full');
            document.body.style.overflow = 'hidden';
        }

        function closeMenu() {
            overlay.classList.add('opacity-0');
            drawer.classList.add('translate-x-full');
            setTimeout(() => {
                overlay.classList.add('hidden');
                document.body.style.overflow = '';
            }, 300);
        }

        menuBtn.addEventListener('click', openMenu);
        closeBtn.addEventListener('click', closeMenu);
        overlay.addEventListener('click', closeMenu);
    }
});