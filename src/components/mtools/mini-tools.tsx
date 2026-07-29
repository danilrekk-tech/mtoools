import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Copy, RefreshCw, Play, Square, Pause } from "lucide-react";
import { toast } from "sonner";

export function Calculator() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<string>("");
  const evaluate = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const val = Function('"use strict";return (' + expr.replace(/[^-()\d/*+.%\s]/g, "") + ")")();
      setResult(String(val));
    } catch { setResult("Ошибка"); }
  };
  return (
    <Card><CardHeader><CardTitle>Калькулятор</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="2 + 2 * 3" onKeyDown={(e) => e.key === "Enter" && evaluate()} />
        <div className="grid grid-cols-4 gap-2">
          {["7","8","9","/","4","5","6","*","1","2","3","-","0",".","(",")"].map(k => (
            <Button key={k} variant="outline" onClick={() => setExpr((s) => s + k)}>{k}</Button>
          ))}
          <Button variant="secondary" className="col-span-2" onClick={() => setExpr("")}>C</Button>
          <Button className="col-span-2 gradient-brand text-white" onClick={evaluate}>=</Button>
        </div>
        {result && <div className="rounded-md border bg-muted p-3 text-right text-2xl font-bold">{result}</div>}
      </CardContent>
    </Card>
  );
}

export function PasswordGen() {
  const [len, setLen] = useState(16);
  const [sym, setSym] = useState(true);
  const [pwd, setPwd] = useState("");
  const gen = () => {
    const set = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" + (sym ? "!@#$%^&*()_+-=[]{}" : "");
    let out = "";
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += set[arr[i] % set.length];
    setPwd(out);
  };
  return (
    <Card><CardHeader><CardTitle>Генератор паролей</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div><Label>Длина: {len}</Label><Slider value={[len]} min={6} max={64} onValueChange={(v) => setLen(v[0])} /></div>
        <div className="flex items-center gap-2"><Switch checked={sym} onCheckedChange={setSym} /><Label>Спецсимволы</Label></div>
        <div className="flex gap-2">
          <Input readOnly value={pwd} placeholder="Нажмите Сгенерировать" className="font-mono" />
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(pwd); toast.success("Скопировано"); }}><Copy className="h-4 w-4" /></Button>
        </div>
        <Button onClick={gen} className="w-full gradient-brand text-white"><RefreshCw className="mr-2 h-4 w-4" />Сгенерировать</Button>
      </CardContent>
    </Card>
  );
}

export function UnitConverter() {
  const [val, setVal] = useState(1);
  const [from, setFrom] = useState("m");
  const [to, setTo] = useState("km");
  const rates: Record<string, number> = { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048 };
  const out = (val * (rates[from] ?? 1)) / (rates[to] ?? 1);
  return (
    <Card><CardHeader><CardTitle>Конвертер длины</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input type="number" value={val} onChange={(e) => setVal(Number(e.target.value))} />
        <div className="grid grid-cols-2 gap-2">
          <select className="rounded-md border bg-background p-2" value={from} onChange={(e) => setFrom(e.target.value)}>
            {Object.keys(rates).map(k => <option key={k}>{k}</option>)}
          </select>
          <select className="rounded-md border bg-background p-2" value={to} onChange={(e) => setTo(e.target.value)}>
            {Object.keys(rates).map(k => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div className="rounded-md border bg-muted p-4 text-center text-2xl font-bold tabular-nums">{out.toFixed(6)} {to}</div>
      </CardContent>
    </Card>
  );
}

export function Notes() {
  const [text, setText] = useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem("mtools-notes") ?? "" : ""));
  return (
    <Card><CardHeader><CardTitle>Заметки</CardTitle></CardHeader>
      <CardContent>
        <Textarea value={text} onChange={(e) => { setText(e.target.value); try { localStorage.setItem("mtools-notes", e.target.value); } catch {} }} rows={12} placeholder="Ваши заметки сохраняются автоматически..." />
      </CardContent>
    </Card>
  );
}

export function Pomodoro() {
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [running]);
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return (
    <Card><CardHeader><CardTitle>Помодоро</CardTitle></CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-8">
        <div className="font-mono text-6xl font-bold tabular-nums">{m}:{s}</div>
        <div className="flex gap-2">
          <Button onClick={() => setRunning((r) => !r)} className={running ? "" : "gradient-brand text-white"} variant={running ? "outline" : "default"}>
            {running ? <><Pause className="mr-2 h-4 w-4" />Пауза</> : <><Play className="mr-2 h-4 w-4" />Старт</>}
          </Button>
          <Button variant="ghost" onClick={() => { setRunning(false); setSecs(25 * 60); }}>Сброс</Button>
        </div>
      </CardContent>
    </Card>
  );
}