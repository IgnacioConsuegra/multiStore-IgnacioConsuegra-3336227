document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || String(user.role).toLowerCase() !== 'admin') {
        window.location.href = '../index.html';
        return;
    }

    const formSection = document.getElementById('collection-form-section');
    const toggleFormBtn = document.getElementById('toggle-form-btn');
    const cancelFormBtn = document.getElementById('cancel-form-btn');
    const collectionForm = document.getElementById('collection-form');
    const formTitle = document.getElementById('form-title');
    const saveBtn = document.getElementById('save-collection-btn');

    const inputId = document.getElementById('collection-id');
    const inputName = document.getElementById('col-name');
    const inputDiscount = document.getElementById('col-discount');
    const inputDesc = document.getElementById('col-desc');
    const inputImage = document.getElementById('col-image');
    const imgPreviewWrapper = document.getElementById('col-image-preview-wrapper');
    const imgPreview = document.getElementById('col-image-preview');
    const inputIcon = document.getElementById('col-icon');
    const iconPreview = document.getElementById('col-icon-preview');
    const tbody = document.getElementById('collections-tbody');

    let collections = [];

    // Normalizar entrada decimal (convertir comas en puntos)
    inputDiscount.addEventListener('input', () => {
        inputDiscount.value = inputDiscount.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    });

    // Vista previa en vivo de la foto
    function updateImagePreview() {
        const url = inputImage.value.trim();
        if (url) {
            imgPreview.src = url;
            imgPreviewWrapper.classList.remove('d-none');
        } else {
            imgPreview.src = '';
            imgPreviewWrapper.classList.add('d-none');
        }
    }
    inputImage.addEventListener('input', updateImagePreview);

    // Vista previa en vivo del ícono
    function updateIconPreview() {
        const iconClass = inputIcon.value.trim() || 'fa-solid fa-layer-group';
        iconPreview.className = iconClass;
    }
    inputIcon.addEventListener('input', updateIconPreview);

    // Botones rápidos de íconos
    document.querySelectorAll('.icon-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            inputIcon.value = btn.dataset.icon;
            updateIconPreview();
        });
    });

    function openForm(isEdit = false) {
        formTitle.textContent = isEdit ? 'Edit Collection' : 'Create New Collection';
        formSection.classList.remove('d-none');
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function resetAndCloseForm() {
        collectionForm.reset();
        inputId.value = '';
        inputName.disabled = false;
        inputDiscount.value = '0.00';
        inputIcon.value = 'fa-solid fa-layer-group';
        updateImagePreview();
        updateIconPreview();
        formSection.classList.add('d-none');
    }

    toggleFormBtn.addEventListener('click', () => {
        if (formSection.classList.contains('d-none')) {
            resetAndCloseForm();
            openForm(false);
        } else {
            resetAndCloseForm();
        }
    });

    cancelFormBtn.addEventListener('click', resetAndCloseForm);

    async function fetchCollections() {
        try {
            const response = await fetch(`../backend/api/categories.php?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Error al obtener colecciones');
            collections = await response.json();
            renderCollections();
        } catch (error) {
            console.error('Error cargando colecciones:', error);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Error loading collections from database.</td></tr>`;
        }
    }

    function renderCollections() {
        tbody.innerHTML = '';

        if (collections.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted-custom">No collections created yet.</td></tr>`;
            return;
        }

        collections.forEach(col => {
            const isAll = String(col.name).trim().toLowerCase() === 'all';
            const discountVal = Number(col.discount || 0);

            const thumbHtml = col.image
                ? `<img src="${col.image}" alt="${col.name}" class="rounded-1 border custom-border-light flex-shrink-0" style="width: 48px; height: 48px; object-fit: cover;">`
                : `<div class="rounded-1 border custom-border-light bg-light d-flex align-items-center justify-content-center flex-shrink-0 text-muted" style="width: 48px; height: 48px;">
                       <i class="${col.icon || 'fa-solid fa-layer-group'}"></i>
                   </div>`;

            const discountHtml = discountVal > 0
                ? `<span class="badge bg-danger">-${discountVal.toFixed(2)}%</span>`
                : `<span class="text-muted-custom small">0%</span>`;

            const deleteBtnHtml = isAll
                ? `<button type="button" class="btn btn-sm btn-outline-secondary rounded-1" disabled title="Default collection cannot be deleted">
                       <i class="fa-solid fa-lock"></i>
                   </button>`
                : `<button type="button" class="btn btn-sm btn-outline-danger rounded-1" onclick="deleteCollection('${col.id}', '${col.name.replace(/'/g, "\\'")}')" title="Delete">
                       <i class="fa-solid fa-trash-can"></i>
                   </button>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 py-3">
                    <div class="d-flex align-items-center gap-3">
                        ${thumbHtml}
                        <div>
                            <span class="font-heading fw-bold text-dark-custom d-block">${col.name}</span>
                            ${isAll ? '<span class="badge bg-secondary-subtle text-dark border small">Default Global</span>' : ''}
                        </div>
                    </div>
                </td>

                <td class="px-4 py-3">
                    <div class="d-inline-flex align-items-center gap-2 px-2 py-1 border custom-border-light rounded-1 bg-white">
                        <i class="${col.icon || 'fa-solid fa-layer-group'} text-dark-custom"></i>
                        <code class="small text-muted">${col.icon || 'fa-solid fa-layer-group'}</code>
                    </div>
                </td>

                <td class="px-4 py-3 text-muted-custom small" style="max-width: 280px;">
                    <span class="d-block text-truncate">${col.description || '—'}</span>
                </td>

                <td class="px-4 py-3 fw-medium text-dark-custom">
                    ${col.count} ${col.count === 1 ? 'item' : 'items'}
                </td>

                <td class="px-4 py-3">
                    ${discountHtml}
                </td>

                <td class="px-4 py-3 text-end">
                    <div class="d-inline-flex gap-2">
                        <button type="button" class="btn btn-sm btn-outline-dark rounded-1" onclick="editCollection('${col.id}')" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        ${deleteBtnHtml}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.editCollection = function (id) {
        const col = collections.find(c => String(c.id) === String(id));
        if (!col) return;

        inputId.value = col.id;
        inputName.value = col.name;
        inputName.disabled = String(col.name).trim().toLowerCase() === 'all';
        inputDiscount.value = Number(col.discount || 0).toFixed(2);
        inputDesc.value = col.description || '';
        inputImage.value = col.image || '';
        inputIcon.value = col.icon || 'fa-solid fa-layer-group';

        updateImagePreview();
        updateIconPreview();
        openForm(true);
    };

    window.deleteCollection = async function (id, name) {
        if (!confirm(`Are you sure you want to delete the collection "${name}"?`)) return;

        try {
            const response = await fetch(`../backend/api/categories.php?id=${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (response.ok && result.status === 'success') {
                fetchCollections();
            } else {
                alert(result.message || 'Could not delete collection.');
            }
        } catch (error) {
            console.error('Error eliminando colección:', error);
            alert('Server connection error.');
        }
    };

    collectionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = inputId.value.trim();
        const isEdit = id !== '';

        const payload = {
            id: isEdit ? id : undefined,
            name: inputName.value.trim(),
            discount: parseFloat(inputDiscount.value.replace(',', '.')) || 0,
            description: inputDesc.value.trim(),
            image: inputImage.value.trim(),
            icon: inputIcon.value.trim() || 'fa-solid fa-layer-group'
        };

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const response = await fetch('../backend/api/categories.php', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                resetAndCloseForm();
                fetchCollections();
            } else {
                alert(result.message || 'Could not save collection.');
            }
        } catch (error) {
            console.error('Error guardando colección:', error);
            alert('Server connection error.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Collection';
        }
    });

    fetchCollections();
});