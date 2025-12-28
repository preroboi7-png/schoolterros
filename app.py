from flask import Flask, render_template, send_from_directory
import os

# O Flask busca automaticamente a pasta 'templates' para o HTML
# e a pasta 'static' para os arquivos de suporte
app = Flask(__name__)

@app.route('/')
def index():
    # Isso buscará o arquivo dentro da pasta /templates
    return render_template('index.html')

# Rota para servir os arquivos de áudio e imagens que estão na raiz ou subpastas
@app.route('/<path:filename>')
def custom_static(filename):
    return send_from_directory('.', filename)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
