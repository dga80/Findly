let searchResults = { inventario: [], sonepar: [] };
let selectedFile = null;

// Tab logic
document.getElementById('manualTab').addEventListener('click', () => {
    document.getElementById('manualTab').classList.add('active');
    document.getElementById('uploadTab').classList.remove('active');
    document.getElementById('manualInputContainer').classList.remove('hidden');
    document.getElementById('uploadInputContainer').classList.add('hidden');
});

document.getElementById('uploadTab').addEventListener('click', () => {
    document.getElementById('uploadTab').classList.add('active');
    document.getElementById('manualTab').classList.remove('active');
    document.getElementById('uploadInputContainer').classList.remove('hidden');
    document.getElementById('manualInputContainer').classList.add('hidden');
});

// File upload logic
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileNameSpan = fileInfo.querySelector('.file-name');

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

function handleFile(file) {
    selectedFile = file;
    fileNameSpan.textContent = file.name;
    fileInfo.classList.remove('hidden');
}

document.getElementById('clearFile').addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
});

document.getElementById('searchBtn').addEventListener('click', async () => {
    let references = [];
    const isManual = !document.getElementById('manualInputContainer').classList.contains('hidden');

    const btn = document.getElementById('searchBtn');
    btn.textContent = "Procesando...";
    btn.disabled = true;
    document.body.classList.add('loading');

    try {
        if (isManual) {
            const text = document.getElementById('refInput').value;
            references = text.split('\n').map(r => r.trim()).filter(r => r !== "");
            if (references.length === 0) throw new Error("Introduce referencias");
        } else {
            if (!selectedFile) throw new Error("Selecciona un archivo");

            // Subir archivo para detectar columnas y extraer datos
            const formData = new FormData();
            formData.append('file', selectedFile);

            const uploadRes = await fetch('http://localhost:5000/upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadRes.ok) {
                const err = await uploadRes.json();
                throw new Error(err.error || 'Error al subir archivo');
            }

            references = await uploadRes.json();
        }

        // Realizar búsqueda
        const response = await fetch('http://localhost:5000/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ references })
        });

        if (!response.ok) throw new Error('Error en la búsqueda');

        searchResults = await response.json();
        renderTables();
        document.getElementById('exportBtn').disabled = false;
    } catch (error) {
        console.error(error);
        alert(error.message || "Ocurrió un error.");
    } finally {
        btn.textContent = "Buscar Stock";
        btn.disabled = false;
        document.body.classList.remove('loading');
    }
});

function renderTables() {
    const invTableBody = document.querySelector('#invTable tbody');
    const sonTableBody = document.querySelector('#sonTable tbody');

    // Actualizar encabezados si es necesario (añadir columna de Cant. Encargo)
    const updateHeaders = (tableId) => {
        const thead = document.querySelector(`#${tableId} thead tr`);
        if (!thead.querySelector('.encargo-header')) {
            const th = document.createElement('th');
            th.className = 'encargo-header';
            th.textContent = 'Cant. Encargo';
            thead.appendChild(th);
        }
    };

    updateHeaders('invTable');
    updateHeaders('sonTable');

    invTableBody.innerHTML = searchResults.inventario.map(item => `
        <tr>
            <td>${item.Referencia}</td>
            <td>${item.Ubicacion || '-'}</td>
            <td>${item.Cantidad}</td>
            <td><span class="cant-encargo">${item.CantEncargo || '-'}</span></td>
        </tr>
    `).join('');

    sonTableBody.innerHTML = searchResults.sonepar.map(item => `
        <tr>
            <td>${item.Referencia}</td>
            <td>${item.Empresa || '-'}</td>
            <td>${item.Cantidad}</td>
            <td><span class="cant-encargo">${item.CantEncargo || '-'}</span></td>
        </tr>
    `).join('');

    if (searchResults.inventario.length === 0 && searchResults.sonepar.length === 0) {
        invTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">No se encontraron resultados</td></tr>';
        sonTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">No se encontraron resultados</td></tr>';
    }
}

document.getElementById('exportBtn').addEventListener('click', () => {
    const wb = XLSX.utils.book_new();

    // Hoja Inventario
    if (searchResults.inventario.length > 0) {
        const wsInv = XLSX.utils.json_to_sheet(searchResults.inventario);
        XLSX.utils.book_append_sheet(wb, wsInv, "Inventario Cerdanya");
    }

    // Hoja Sonepar
    if (searchResults.sonepar.length > 0) {
        const wsSon = XLSX.utils.json_to_sheet(searchResults.sonepar);
        XLSX.utils.book_append_sheet(wb, wsSon, "Stock Sonepar");
    }

    if (searchResults.inventario.length === 0 && searchResults.sonepar.length === 0) {
        alert("No hay resultados para exportar");
        return;
    }

    XLSX.writeFile(wb, "Findly_Resultados.xlsx");
});
