import os
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Rutas de los archivos de Excel
PATH_INVENTARIO = r"\\172.30.0.10\Logistica\06-ALMACENES\06.01-ALMACEN CERDANYA\STOCK\INVENTARIO Cerdanya (NUEVO).xlsx"
PATH_SONEPAR = r"\\172.30.0.10\Logistica\06-ALMACENES\06.01-ALMACEN CERDANYA\STOCK\STOCK SCHNEIDER-SONEPAR 26.xlsx"

def read_inventario():
    try:
        # Col A = Ubicación (index 0), Col B = Referencia (index 1), Col E = Cantidad (index 4)
        df = pd.read_excel(PATH_INVENTARIO, usecols=[0, 1, 4])
        df.columns = ['Ubicacion', 'Referencia', 'Cantidad']
        return df.dropna(subset=['Referencia'])
    except Exception as e:
        print(f"Error reading Inventario: {e}")
        return pd.DataFrame(columns=['Ubicacion', 'Referencia', 'Cantidad'])

def read_sonepar():
    try:
        # Col B = Referencia (index 1), Col Q = Empresa (index 16), Col AE = Cantidad (index 30)
        df = pd.read_excel(PATH_SONEPAR, usecols=[1, 16, 30])
        df.columns = ['Referencia', 'Empresa', 'Cantidad']
        return df.dropna(subset=['Referencia'])
    except Exception as e:
        print(f"Error reading Sonepar: {e}")
        return pd.DataFrame(columns=['Referencia', 'Empresa', 'Cantidad'])

@app.route('/search', methods=['POST'])
def search():
    data = request.json
    references = data.get('references', [])
    if not references:
        return jsonify({'inventario': [], 'sonepar': []})

    # Limpiar referencias (quitar espacios, etc)
    references = [str(r).strip() for r in references if str(r).strip()]

    df_inv = read_inventario()
    df_son = read_sonepar()

    # Convertir referencias a string para comparar
    df_inv['Referencia'] = df_inv['Referencia'].astype(str).str.strip()
    df_son['Referencia'] = df_son['Referencia'].astype(str).str.strip()

    # Filtrar resultados
    res_inv = df_inv[df_inv['Referencia'].isin(references)].to_dict('records')
    res_son = df_son[df_son['Referencia'].isin(references)].to_dict('records')

    return jsonify({
        'inventario': res_inv,
        'sonepar': res_son
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
