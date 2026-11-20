function initNavBar() {
    const userActionsContainer = document.getElementById('user-actions-container');
    const mobileNavContainer = document.getElementById('mobile-nav-container');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuIcon = document.getElementById('mobile-menu-icon');

    let userData = null;
    try {
        userData = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
        console.error("Error leyendo el usuario del localStorage", e);
    }

    if (userData && !userData.role) {
        userData.role = "Admin";
        localStorage.setItem('user', JSON.stringify(userData));
    }

    if (userData && userActionsContainer) {
        const isAdmin = userData.role && userData.role.toLowerCase() === 'admin';
        const adminLinkHTML = isAdmin ? `<a href="/views/admin.html" class="dropdown-item-custom" style="color: var(--accent);">Admin Dashboard</a>` : '';

        userActionsContainer.innerHTML = `
            <div class="user-group">
                <a href="/views/profile.html" class="action-btn text-muted-custom text-decoration-none" aria-label="Profile">
                    <i class="fa-solid fa-user"></i>
                </a>
                
                <div class="user-dropdown">
                    <div class="p-3 border-bottom custom-border-light">
                        <p class="mb-0 fw-medium text-dark-custom" style="font-size: 0.875rem;">${userData.name}</p>
                        <p class="mb-0 text-muted-custom" style="font-size: 0.75rem;">${userData.email}</p>
                    </div>
                    <div class="py-1">
                        <a href="/views/profile.html" class="dropdown-item-custom">My Profile</a>
                        <a href="/views/profile.html" class="dropdown-item-custom">Orders</a>
                        ${adminLinkHTML}
                    </div>
                    <div class="border-top custom-border-light py-1">
                        <button id="logout-btn" class="dropdown-item-custom text-muted-custom">Logout</button>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    localStorage.removeItem('user');
                    window.location.reload();
                });
            }
        }, 0);

    } else {
        if (userActionsContainer) {
            userActionsContainer.innerHTML = `
                <div class="d-none d-md-flex align-items-center gap-3 ms-3">
                    <a href="/views/login.html" class="btn-signin">Sign In</a>
                </div>
            `;
        }
        if (mobileNavContainer) {
            mobileNavContainer.innerHTML += `
                <div class="border-top custom-border-light pt-3 mt-2 d-flex flex-column gap-3">
                    <a href="/views/signup.html" class="text-decoration-none text-dark-custom fw-bold small">Sign Up</a>
                </div>
            `;
        }
    }

    if (mobileMenuBtn && mobileMenu && mobileMenuIcon) {
        let isMenuOpen = false;

        mobileMenuBtn.addEventListener('click', () => {
            isMenuOpen = !isMenuOpen;

            if (isMenuOpen) {
                mobileMenu.classList.remove('d-none');
                mobileMenu.style.display = 'block';
                mobileMenuIcon.classList.remove('fa-bars');
                mobileMenuIcon.classList.add('fa-xmark');
            } else {
                mobileMenu.classList.add('d-none');
                mobileMenu.style.display = 'none';
                mobileMenuIcon.classList.remove('fa-xmark');
                mobileMenuIcon.classList.add('fa-bars');
            }
        });




    }



    setActiveNavLink();
}
function setActiveNavLink() {
    const currentPath = window.location.pathname.toLowerCase();

    const navLinks = document.querySelectorAll('.desktop-nav a, #mobile-nav-container a');

    navLinks.forEach(link => {
        const href = link.getAttribute('href').toLowerCase();

        const isHome = currentPath === '/' || currentPath.endsWith('index.html');
        const isCurrentMatch = (isHome && href === '/') || (!isHome && href !== '/' && currentPath.includes(href));

        if (isCurrentMatch) {
            link.classList.add('text-dark-custom', 'active');
            link.classList.remove('text-muted-custom');

            if (link.closest('#mobile-nav-container')) {
                link.classList.add('fw-bold');
                link.classList.remove('fw-medium');
            }
        } else {
            link.classList.add('text-muted-custom');
            link.classList.remove('text-dark-custom', 'active');

            if (link.closest('#mobile-nav-container')) {
                link.classList.add('fw-medium');
                link.classList.remove('fw-bold');
            }
        }
    });
}
