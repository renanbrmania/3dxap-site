# Printer agent (Elgin) — PC da Paula

## Setup no Windows (recomendado)

1. Instale o **Node.js LTS**: https://nodejs.org  
2. Copie esta pasta para o PC (ex.: `C:\3dxap\printer-agent`)  
3. Dê dois cliques em **`setup-windows.bat`**

Isso:
- confere se o Node está instalado  
- coloca o agent para **iniciar com o Windows**  
- liga o agent agora (em segundo plano)

Depois use o admin: **Impressão** → selecionar → imprimir.

## Manual

- `iniciar-agent.bat` — liga com janela visível (útil para ver erros)  
- `remover-inicio-windows.bat` — tira do início automático  

Agent em `http://127.0.0.1:9109` (mesma rede Wi‑Fi da Elgin).

## Se “Imprimir” no admin não faz nada

1. No **mesmo PC** do navegador, abra `http://127.0.0.1:9109/health` — tem que aparecer JSON `ok: true`.  
2. Se não abrir: rode `iniciar-agent.bat` de novo.  
3. Use **Chrome ou Edge** no admin (`https://www.3dxap.com.br/admin`). Se o navegador pedir permissão de **rede local**, aceite.  
4. Depois de atualizar esta pasta, **feche o agent antigo** (barra de tarefas / fechar janela) e abra de novo o `iniciar-agent.bat`.
