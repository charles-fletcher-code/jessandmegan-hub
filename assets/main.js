(function() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  const currentPath = window.location.pathname;

  const links = [
    { label: 'About', href: '/about/' },
    { label: 'Listings', href: '/listings/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Neighborhoods', href: '/neighborhoods/' },
    { label: 'Buyers', href: '/buyers/' },
    { label: 'Services', href: '/services/' },
  ];

  const navHTML = `
    <div class="nav-inner">
      <a class="nav-logo" href="/">J&amp;M</a>
      <ul class="nav-links">
        ${links.map(l => {
          const isCurrent = currentPath === l.href || (l.href !== '/' && currentPath.startsWith(l.href));
          return `<li><a href="${l.href}"${isCurrent ? ' aria-current="page"' : ''}>${l.label}</a></li>`;
        }).join('')}
      </ul>
      <a href="/contact/" class="nav-cta">What's My Home Worth?</a>
    </div>
  `;

  nav.innerHTML = navHTML;
})();
