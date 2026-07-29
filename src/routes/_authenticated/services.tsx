import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { servicesQuery } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { DynIcon } from "@/components/mtools/icon";

export const Route = createFileRoute("/_authenticated/services")({
  head: () => ({ meta: [{ title: "Сервисы · MTools" }, { name: "description", content: "Каталог внешних сервисов компании." }] }),
  component: Services,
});

function Services() {
  const { data: services } = useSuspenseQuery(servicesQuery());
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Сервисы компании</h1>
      {services.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Сервисы ещё не добавлены</CardContent></Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((s: any) => (
          <Card key={s.id} className="transition hover:shadow-md">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <DynIcon name={s.icon} className="h-5 w-5" />
                </div>
                {s.department && <Badge variant="outline" style={{ borderColor: s.department.color }}>{s.department.name}</Badge>}
              </div>
              <div>
                <div className="font-semibold">{s.name}</div>
                {s.description && <div className="mt-1 text-sm text-muted-foreground">{s.description}</div>}
              </div>
              <Button asChild variant="outline" className="w-full">
                <a href={s.url} target="_blank" rel="noreferrer">Открыть <ExternalLink className="ml-2 h-4 w-4" /></a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}