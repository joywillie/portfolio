document.addEventListener("DOMContentLoaded", function() {
  const hamburger = document.getElementById('hamburger-menu');
  const navLinks = document.getElementById('nav-links');
  const body = document.body;

  // Master toggle function for menu states
  function toggleMenu() {
    hamburger.classList.toggle('active');  /* Triggers the CSS "X" morph animation */
    navLinks.classList.toggle('active');   /* Slides the mobile menu panel into view */
    body.classList.toggle('menu-locked');  /* Prevents background page scrolling */
  }

  if (hamburger && navLinks) {
    // 1. Toggle menu on hamburger click
    hamburger.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevents immediate closing from the document click listener
      toggleMenu();
    });

    // 2. Automatically close drawer when any internal link is clicked
    const links = navLinks.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
        body.classList.remove('menu-locked');
      });
    });

    // 3. Close the menu if the user clicks anywhere outside the nav drawer
    document.addEventListener('click', function(e) {
      if (navLinks.classList.contains('active') && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
        body.classList.remove('menu-locked');
      }
    });
  }
});
