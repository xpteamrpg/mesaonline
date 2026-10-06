// Atualiza no manifesto da trava visual só o hash dos arquivos de texto indicados (CRLF→LF, como o verificador).
const fs=require("fs"),c=require("crypto");
const p="scripts/visual-lock.manifest.json";let m=fs.readFileSync(p,"utf8");
for(const f of process.argv.slice(2)){
 const h=c.createHash("sha256").update(Buffer.from(fs.readFileSync(f,"utf8").replace(/\r\n/g,"\n"),"utf8")).digest("hex");
 const re=new RegExp("(\""+f.replace(/[.\/]/g,"\$&")+"\": \")[0-9a-f]{64}");
 if(!re.test(m)) throw new Error("sem entrada: "+f); m=m.replace(re,"$1"+h);
}
fs.writeFileSync(p,m);console.log("manifesto atualizado");
