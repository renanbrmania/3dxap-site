import { discoverElginPrinter, sendZpl } from "./discover.mjs";

const zpl = `^XA
^PW832
^LL646
^MD30
^FO40,40^A0N,40,40^FD3DXAP - Teste DHCP^FS
^FO40,100^A0N,28,28^FDElgin L42 PRO FULL^FS
^FO40,150^A0N,24,24^FDDescoberta automatica na rede^FS
^FO40,220^BQN,2,5^FDQA,https://www.3dxap.com.br^FS
^FO40,480^A0N,22,22^FDSe leu isto, o agent achou a impressora.^FS
^XZ`;

const printer = await discoverElginPrinter();
console.log("Impressora:", printer.ip, printer.hostInfo);
await sendZpl(zpl, { host: printer.ip });
console.log("Etiqueta de teste enviada.");
