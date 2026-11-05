import { createReadStream, writeFileSync, mkdirSync} from "node:fs";
import { createInterface } from "node:readline";


interface Registro {
    idMonitorado: number;
    faccaoMonitorado: string | null;
    timestamp: string;
    latitude: number;
    longitude: number;
    medidaProtetiva: boolean;
    idsRestricaoMedida: number[];
}

interface Encontro {
    tipo: "generico" | "faccao" | "protetiva";
    monitoradosEncontro: number[];
    timestamp: string;
    posicoes: Record<string, {lat: number; lon: number}>;
    distanciaMetros: number;
}

function parseRegistros(linha: string): Registro {
    const campos = linha.replaceAll('"', "").split(";");
    return {
        idMonitorado: Number(campos[0]),
        faccaoMonitorado: campos[1] === "" ? null : campos[1],
        timestamp: campos[2],
        latitude: Number(campos[3]),
        longitude: Number(campos[4]),
        medidaProtetiva: campos[5] === "true",
        idsRestricaoMedida: campos[6] === "" ? [] : campos[6].split(",").map(Number)
    }
}

const R = 6371000;
const LIMIAR_LAT = (20 / R) * (180 / Math.PI) * 1.001;

function toRad(grau: number): number {
    return (grau * Math.PI) / 180;
}

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {

    const DlatR = toRad(lat2 - lat1);
    const DlonR = toRad(lon2 - lon1);

    const Rlat1 = toRad(lat1);
    const Rlat2 = toRad(lat2);

    const a = Math.sin(DlatR/2) * Math.sin(DlatR/2) + Math.cos(Rlat1) * Math.cos(Rlat2) * Math.sin(DlonR/2) * Math.sin(DlonR/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

async function processarDataset(caminho: string): Promise<Encontro[]> {
    const leitor = createInterface({
        input: createReadStream(caminho),
        crlfDelay: Infinity,
    });

    const encontros: Encontro[] = [];
    let grupo: Registro[] = [];
    let timestampAtual = "";
    let primeiraLinha = true;

    for await (const linha of leitor) {
        if(primeiraLinha) { primeiraLinha = false; continue; }
        if(linha.trim() === "") continue;

        const r = parseRegistros(linha);

        if(r.timestamp !== timestampAtual) {
            if(grupo.length > 0) {
                detectarEncontros(timestampAtual, grupo, encontros);
            }
            grupo = [];
            timestampAtual = r.timestamp;
        }
        grupo.push(r);
    }

    if (grupo.length > 0) {
        detectarEncontros(timestampAtual, grupo, encontros);
    }

    return encontros;
}


function classificarEncontros(a: Registro, b:Registro): "generico" | "faccao" | "protetiva" {

    if(a.faccaoMonitorado !== null && a.faccaoMonitorado === b.faccaoMonitorado) {
        return "faccao";
    }

    const AdeB = a.medidaProtetiva && a.idsRestricaoMedida.includes(b.idMonitorado);
    const BdeA = b.medidaProtetiva && b.idsRestricaoMedida.includes(a.idMonitorado);

    if(AdeB || BdeA) {
        return "protetiva";
    }

    return "generico";
}

function detectarEncontros(timestamp: string, lista: Registro[], encontros: Encontro[]): void {
    for (let i = 0; i < lista.length; i++) {
        for (let j = i + 1; j < lista.length; j++) {
            const a = lista[i]!; const b = lista[j]!;
            if (a.idMonitorado === b.idMonitorado) continue;
            if (Math.abs(a.latitude - b.latitude) > LIMIAR_LAT) continue;
            const dist = calcularDistancia(a.latitude, a.longitude, b.latitude, b.longitude);
            if (dist < 20) {
                const tipo = classificarEncontros(a, b);
                encontros.push({
                    tipo: tipo,
                    monitoradosEncontro: [a.idMonitorado, b.idMonitorado],
                    timestamp: timestamp,
                    posicoes: {
                        [a.idMonitorado]: { lat: a.latitude, lon: a.longitude },
                        [b.idMonitorado]: { lat: b.latitude, lon: b.longitude }
                    },
                    distanciaMetros: dist
                });
            }
        }
    }
}


async function main() {
    mkdirSync("output", { recursive: true });

    for (let n = 1; n <= 7; n++) {
        const encontros = await processarDataset(`data/dataset${n}.txt`);
        writeFileSync(`output/resposta${n}.json`, JSON.stringify(encontros, null, 2));
    }
}

main();

