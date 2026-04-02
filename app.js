let searchResults = { inventario: [], sonepar: [], sti: [] };
let selectedFile = null;
let currentInputData = [];

// Tab logic — "Subir Excel" activo por defecto
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
            const refs = text.split('\n').map(r => r.trim()).filter(r => r !== "");
            if (refs.length === 0) throw new Error("Introduce referencias");
            currentInputData = refs.map(r => ({ reference: r, quantity: 1 }));
            references = refs;
        } else {
            if (!selectedFile) throw new Error("Selecciona un archivo");

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

            currentInputData = await uploadRes.json();
            references = currentInputData;
        }

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

        document.getElementById('exportStockBtn').disabled = (
            searchResults.inventario.length === 0 &&
            searchResults.sonepar.length === 0
        );
        document.getElementById('exportPdfBtn').disabled = document.getElementById('exportStockBtn').disabled;

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
    const stiTableBody = document.querySelector('#stiTable tbody');

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

    // Identificar referencias duplicadas en ambos listados
    const invRefs = new Set(searchResults.inventario.map(item => String(item.Referencia).trim().toUpperCase()));
    const repeatRefs = new Set(searchResults.sonepar
        .map(item => String(item.Referencia).trim().toUpperCase())
        .filter(ref => invRefs.has(ref)));

    // Renderizar Inventario Cerdanya
    invTableBody.innerHTML = searchResults.inventario.length > 0
        ? searchResults.inventario.map(item => {
            const isRepeat = repeatRefs.has(String(item.Referencia).trim().toUpperCase());
            return `
                <tr>
                    <td>${item.Referencia}</td>
                    <td>${item.Ubicacion || '-'}</td>
                    <td><span class="${isRepeat ? 'common-stock-badge' : ''}">${item.Cantidad}</span></td>
                    <td><span class="cant-encargo">${item.CantEncargo || '-'}</span></td>
                </tr>
            `;
        }).join('')
        : '<tr><td colspan="4" style="text-align:center">No se encontraron resultados</td></tr>';

    // Renderizar Stock Sonepar
    sonTableBody.innerHTML = searchResults.sonepar.length > 0
        ? searchResults.sonepar.map(item => {
            const isRepeat = repeatRefs.has(String(item.Referencia).trim().toUpperCase());
            return `
                <tr>
                    <td>${item.Referencia}</td>
                    <td>${item.Empresa || '-'}</td>
                    <td><span class="${isRepeat ? 'common-stock-badge' : ''}">${item.Cantidad}</span></td>
                    <td><span class="cant-encargo">${item.CantEncargo || '-'}</span></td>
                </tr>
            `;
        }).join('')
        : '<tr><td colspan="4" style="text-align:center">No se encontraron resultados</td></tr>';

    // Renderizar Stock STI
    // searchResults.sti es una lista de referencias que coinciden en el archivo ZOE STI
    const stiSet = new Set((searchResults.sti || []).map(r => String(r).trim().toUpperCase()));

    // Construir la lista a partir de todas las referencias buscadas
    const allRefs = [...new Set(currentInputData.map(item =>
        String(item.reference || item).trim()
    ))];

    const stiRows = allRefs.filter(ref => stiSet.has(ref.toUpperCase()));

    stiTableBody.innerHTML = stiRows.length > 0
        ? stiRows.map(ref => `
            <tr>
                <td>${ref}</td>
                <td><span class="sti-badge">✔ Disponible</span></td>
            </tr>
        `).join('')
        : '<tr><td colspan="2" style="text-align:center">Sin coincidencias en STI</td></tr>';
}

document.getElementById('exportStockBtn').addEventListener('click', () => {
    const wb = XLSX.utils.book_new();
    if (searchResults.inventario.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(searchResults.inventario), "Inventario Cerdanya");
    }
    if (searchResults.sonepar.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(searchResults.sonepar), "Stock Sonepar");
    }
    if ((searchResults.sti || []).length > 0) {
        const stiExport = searchResults.sti.map(ref => ({ Referencia: ref, 'En STI': 'Sí' }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stiExport), "Stock STI");
    }

    let fileName = "Findly_Stock.xlsx";
    if (selectedFile) {
        const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'));
        fileName = `${baseName} STOCK.xlsx`;
    }
    XLSX.writeFile(wb, fileName);
});

document.getElementById('exportPdfBtn').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Configuración estética
    const primaryColor = [30, 41, 59]; // #1e293b
    const accentColor = [37, 99, 235];  // #2563eb
    
    // Título y Cabecera
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...primaryColor);
    doc.text("Findly - Informe de Stock", 15, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleString('es-ES', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
    doc.text(`Generado el: ${dateStr}`, 15, 27);
    
    if (selectedFile) {
        doc.setFont("helvetica", "italic");
        doc.text(`Archivo origen: ${selectedFile.name}`, 15, 32);
    }
    
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.5);
    doc.line(15, 35, pageWidth - 15, 35);

    // Consolidar datos para las columnas
    // Combinamos Inventario y Sonepar
    const allItems = [];
    
    searchResults.inventario.forEach(item => {
        allItems.push({
            ref: item.Referencia,
            info: item.Ubicacion || 'INV',
            qty: item.Cantidad,
            origin: 'Cerdanya'
        });
    });
    
    searchResults.sonepar.forEach(item => {
        allItems.push({
            ref: item.Referencia,
            info: item.Empresa || 'SON',
            qty: item.Cantidad,
            origin: 'Sonepar'
        });
    });

    if (allItems.length === 0) {
        doc.text("No hay datos de stock para mostrar.", 15, 45);
        doc.save("Stock_Findly.pdf");
        return;
    }

    // Dividir en 3 columnas
    const colCount = 3;
    const itemsPerCol = Math.ceil(allItems.length / colCount);
    const columns = [[], [], []];
    
    for (let i = 0; i < allItems.length; i++) {
        const colIdx = Math.floor(i / itemsPerCol);
        if (colIdx < colCount) {
            columns[colIdx].push(allItems[i]);
        }
    }

    // Dibujar las 3 tablas side-by-side
    const startY = 42;
    const colWidth = (pageWidth - 30 - 10) / 3; // 30 margen total, 10 espacio entre columnas (5+5)
    const gutter = 5;

    columns.forEach((colData, index) => {
        if (colData.length === 0) return;

        doc.autoTable({
            startY: startY,
            margin: { left: 15 + (index * (colWidth + gutter)) },
            tableWidth: colWidth,
            body: colData.map(item => [
                { content: `${item.ref}\n${item.info}`, styles: { fontSize: 7 } },
                { content: item.qty, styles: { halign: 'center', fontSize: 8, fontStyle: 'bold' } }
            ]),
            theme: 'striped',
            styles: {
                cellPadding: 1,
                overflow: 'linebreak',
                lineColor: [226, 232, 240]
            },
            head: index === 0 ? [] : [], // Sin cabecera para ahorrar espacio
            columnStyles: {
                0: { cellWidth: colWidth * 0.75 },
                1: { cellWidth: colWidth * 0.25 }
            },
            didParseCell: function(data) {
                // Si la referencia está en ambos stocks, podríamos destacarla (opcional)
                // if (data.section === 'body' && data.column.index === 1) {
                //     data.cell.styles.textColor = accentColor;
                // }
            }
        });
    });

    let fileName = "Findly_Stock.pdf";
    if (selectedFile) {
        const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'));
        fileName = `${baseName} STOCK.pdf`;
    }
    doc.save(fileName);
});
