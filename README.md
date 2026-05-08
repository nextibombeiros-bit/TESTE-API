# Teste API Nexti

Este projeto é um teste simples em Node.js para validar a API da Nexti, focando em identificar marcações de ponto fora da unidade para colaboradores bombeiros. Inclui um site estático para visualizar os resultados.

## Objetivo

Extrair dados da API da Nexti e verificar marcações de ponto fora da unidade, inicialmente para bombeiros. O site permite visualizar alertas com localização e fotos.

## Instalação

1. Clone o repositório.
2. Instale as dependências:
   ```
   npm install
   ```

## Configuração

1. Copie o arquivo `.env.example` para `.env`:
   ```
   cp .env.example .env
   ```

2. Edite o arquivo `.env` e cole o Bearer token da API Nexti:
   ```
   NEXTI_TOKEN=seu_token_aqui
   NEXTI_BASE_URL=https://api.nexti.com
   TEST_START=07052026000000
   TEST_FINISH=07052026235959
   ALLOWED_DISTANCE_METERS=300
   ```

   **Atenção:** Não commite o arquivo `.env` com credenciais reais.

## Execução

Execute o teste:
```
npm run test:nexti
```

O script irá:
- Buscar pessoas e filtrar bombeiros.
- Buscar marcações no período especificado.
- Calcular distâncias e gerar alertas.
- Salvar arquivos JSON em `output/` e fotos em `output/photos/`.

## Visualização Local

Abra `index.html` no navegador para ver os alertas localmente.

## Deploy no GitHub Pages

1. Commit e push os arquivos gerados em `output/` (exceto fotos se preferir não expor).
2. Vá para as configurações do repositório no GitHub: Settings > Pages.
3. Selecione "Deploy from a branch" > Branch: main > Folder: /(root).
4. Salve e aguarde o deploy. O site ficará disponível em `https://nextibombeiros-bit.github.io/TESTE-API/`.

## Arquivos de Saída

- `output/bombeiros.json`: Lista de bombeiros encontrados.
- `output/clockings_raw_sanitized.json`: Marcações sanitizadas.
- `output/clockings_bombeiros.json`: Marcações apenas dos bombeiros.
- `output/workplaces_sanitized.json`: Postos/unidades.
- `output/alertas_fora_unidade.json`: Alertas de marcações fora da unidade.
- `output/photos/`: Fotos das marcações (se disponíveis).

## Interpretação dos Resultados

- Verifique o console para resumo.
- Analise `alertas_fora_unidade.json` ou o site para identificar problemas.
- Status possíveis: NORMAL, SEM_LOCALIZACAO, POSTO_SEM_COORDENADA, ATENCAO_FORA_PERIMETRO, FORA_DA_UNIDADE, CRITICO_FORA_DA_UNIDADE.
- Mapas mostram localização da marcação e da unidade.
- Fotos são exibidas se disponíveis.

## Segurança

- Não salvar tokens ou CPFs completos.
- Não commite credenciais.
- Dados sensíveis são mascarados nos arquivos de saída.