document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('adminManagement');
    if (!container) return;

    fetch('../components/admin-nav.html')
        .then(response => response.text())
        .then(data => {
            container.innerHTML = data;

            const currentPath = window.location.pathname.toLowerCase();

            if (currentPath.includes('products-management')) {
                document.getElementById('nav-products')?.classList.add('active');
            } else if (currentPath.includes('collections-management')) {
                document.getElementById('nav-collections')?.classList.add('active');
            } else if (currentPath.includes('admin-order')) {
                document.getElementById('nav-orders')?.classList.add('active');
            } else {
                document.getElementById('nav-analytics')?.classList.add('active');
            }
        })
        .catch(error => console.error("Error cargando la navegación de admin:", error));
});