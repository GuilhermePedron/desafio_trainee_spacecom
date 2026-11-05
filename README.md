# Detecção de Encontros

Algoritmo em TypeScript (Node.js) que processa dados de geolocalização de monitorados e vítimas com medida protetiva, e detecta três tipos de encontro:

- **genérico**: dois monitorados a menos de 20 m um do outro;
- **facção**: dois monitorados da mesma facção a menos de 20 m;
- **protetiva**: um agressor a menos de 20 m da sua respectiva vítima.

---

## Como executar

**Requisitos:** Node.js 18 ou superior.

```bash
npm install
npx tsx src/index.ts
```

Os datasets devem estar na pasta `data/` com os nomes `dataset1.txt` … `dataset7.txt`. Os resultados são gravados em `output/resposta1.json` … `output/resposta7.json`.

---

## Estrutura

```
data/        datasets de entrada (.txt)
output/      arquivos JSON gerados
src/
  index.ts   código-fonte completo
```

O código é dividido em funções com uma responsabilidade cada:

| Função | Responsabilidade |
|---|---|
| `parseRegistros` | Converte uma linha do arquivo em um objeto `Registro` tipado |
| `calcularDistancia` | Fórmula de Haversine (R = 6.371.000 m) |
| `classificarEncontros` | Decide o tipo do encontro entre dois registros |
| `detectarEncontros` | Compara todos os pares de um mesmo timestamp |
| `processarDataset` | Lê o arquivo linha a linha e agrupa por timestamp |

---

## Lógica

### 1. Leitura em streaming

O arquivo é lido linha por linha com `createReadStream` + `readline`, em vez de carregado inteiro na memória.
Em uma primeira implementacao, utilizei `readFileSync`, que funcionou ate o dataset6, mas com o dataset7 acontecia o erro `ERR_STRING_TOO_LONG`, pois ultrapassava o tamanho maximo de string do motor Node.


### 2. Parse

Em cada linha os campos sao divididos por `;` e convertidos para o tipo correto

- as aspas do timestamp e da lista de restricoes sao removidas;
- faccao vazia tratada com null, para que 2 pessoas sem faccao nao sejam consideradas da mesma faccao;
- idsRestricaoMedida vira number[], com o caso vazio tratado  ("".split(",") retorna [""], que viraria [0]);

### 3. Agrupamento por timestamp

Os encontros devem acontecer sempre no mesmo timestamp, entao como os datasets estao ordenados, cada timestamp é armazenado em um grupo do tempo atual, quando o timestamp muda os encontros do grupo sao processados e o grupo atual é descartado e comeca um novo com o timestampatual atualizado. Ao final do arquivo o ultimo grupo é processado.


### 4. Comparação de pares

Dentro de um grupo, cada par é comparado uma vez por um loop duplo de i=0 e j=i+1, garantindo unicidade (cada par uma vez por timestamp), nao deixando que ninguem seja comparado consigo mesmo.

### 5. Distância (Haversine) com filtro prévio

Antes de calcular a distancia entre dois registros, faz uma comparacao com um limiar de 20m de latitude, evitando calculos desnecessarios (latitude utilizada por 
um grau de latitude ter o mesmo comprimento em qualquer ponto do planeta).
Se só a diferença de latitude já é maior que 20 m, a distância total também é, então o filtro não descarta nenhum encontro válido.


### 6. Classificação

Para cada par a menos de 20 m:

1. **facção** — os dois têm facção (não nula) e ela é a mesma;
2. **protetiva** — um dos dois tem medida protetiva e o outro está na sua lista de restrição (os dois lados são testados);
3. **genérico** — qualquer outro caso.

### 7. Saída

Cada encontro é montado já no formato exigido e o array final é gravado com `JSON.stringify`.

---

## Validação

Os resultados dos datasets 1 e 2 foram comparados com os gabaritos fornecidos (`respostas1.json` e `respostas2.json`) e todos os encontros estao corretos.

No dataset2, em um dos encontros o valor de `distanciaMetros` fica com um digito diferente do gabarito (`8.90961951633724` vs. `8.909619516337239`, ondem de 10^-15), provavelmente por diferenca de arredondamento da formula. 

---


## Uso de IA e pesquisas na internet

Foi utilizado como ferramente de auxilio um modelo de linguagem de grande porte (claude versao web). 
Por ter pouca familiaridade com a linguagem e o framework, usei principalmente para utilizar corretamente a sintaxe da linguagem e revisar o codigo. Tambem para formatar o texto desse arquivo README.

Quando necessario pesquisei informacoes relacionadas a linguagem, formulas e como fazer corretamente o que estava pensando na internet.

## Por que você considera esta a melhor abordagem para o problema.

Acredito que que tenha ficado simples (tanto para escrever como para ler) e funcional para os casos apresentados e possiveis datasets semelhantes.
Os resultados de teste bateram.
Funcoes simples com resposabilidades definidas.
