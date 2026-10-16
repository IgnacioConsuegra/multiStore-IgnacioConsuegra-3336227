document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('adminManagement');
    
    if (!container) return; // Si no estamos en una página de admin, no hace nada

    // Ajusta la ruta a tu carpeta components si es necesario
    fetch('../components/admin-nav.html') 
        .then(response => response.text())
        .then(data => {
            // Inyectar el HTML
            container.innerHTML = data;

            // Leer la URL actual
            const currentPath = window.location.pathname.toLowerCase();
            
            // Lógica para marcar la pestaña activa
            if (currentPath.includes('products-management')) {
                document.getElementById('nav-products').classList.add('active');
            } else if (currentPath.includes('admin-orders')) {
                document.getElementById('nav-orders').classList.add('active');
            } else {
                // Por defecto (admin.html)
                document.getElementById('nav-analytics').classList.add('active');
            }
        })
        .catch(error => console.error("Error cargando la navegación de admin:", error));
});