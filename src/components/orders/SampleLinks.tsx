import { Link } from "react-router-dom";
import { sampleLinks, type OrderSampleRef } from "@/lib/orders/orderSamples";

export function SampleLinks({ samples }: { samples: OrderSampleRef[] }) {
  const links = sampleLinks(samples);
  if (!links.length) return <>–</>;
  return (
    <div className="flex min-w-[140px] max-w-[260px] flex-col gap-1 whitespace-normal">
      {links.map(sample => (
        <Link key={sample.id} to={sample.href} title={sample.label}
          className="text-primary hover:underline break-words [overflow-wrap:anywhere]">
          {sample.label}
        </Link>
      ))}
    </div>
  );
}