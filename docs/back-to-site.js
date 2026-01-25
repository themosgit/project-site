// Script to add "Back to Site" link to the titlearea
(function() {
    function addBackToSiteLink() {
        var projectalign = document.getElementById('projectalign');
        var projectname = document.getElementById('projectname');
        
        if (projectalign && projectname && !document.getElementById('back-to-site-link')) {
            // Create back to site link
            var backLink = document.createElement('a');
            backLink.id = 'back-to-site-link';
            backLink.href = '../index.html';
            backLink.textContent = '← Back to Site';
            backLink.className = 'back-to-site-link';
            backLink.style.cssText = 'font-size: 14px; color: var(--page-link-color, #3b82f6); text-decoration: none; font-weight: 500; padding: 6px 14px; border-radius: 6px; transition: all 0.2s; display: inline-block; margin-top: 8px;';
            backLink.onmouseover = function() {
                this.style.backgroundColor = 'var(--nav-menu-active-bg, #eff6ff)';
                this.style.textDecoration = 'none';
            };
            backLink.onmouseout = function() {
                this.style.backgroundColor = 'transparent';
            };
            
            // Add link after projectbrief or at the end of projectalign
            var projectbrief = document.getElementById('projectbrief');
            if (projectbrief && projectbrief.nextSibling) {
                projectbrief.parentNode.insertBefore(backLink, projectbrief.nextSibling);
            } else if (projectbrief) {
                projectbrief.parentNode.appendChild(backLink);
            } else {
                projectalign.appendChild(backLink);
            }
        }
    }
    
    // Try immediately if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addBackToSiteLink);
    } else {
        addBackToSiteLink();
    }
    
    // Also try after a short delay in case elements are added dynamically
    setTimeout(addBackToSiteLink, 100);
})();
