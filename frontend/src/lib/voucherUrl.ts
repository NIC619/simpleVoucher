export interface VoucherUrlParts {
  issuer: string;
  topic: string;
  voucher: string;
}

export type VoucherRoute = "redeem" | "post" | "claim";

export function buildVoucherUrl({
  origin,
  route,
  issuer,
  topic,
  voucher,
}: VoucherUrlParts & { origin: string; route: VoucherRoute }): string {
  return `${origin}/${route}/${issuer}/${encodeURIComponent(topic)}/${voucher}`;
}

export function parseVoucherUrl(url: string, allowedRoutes: VoucherRoute[]): VoucherUrlParts | null {
  try {
    let pathname: string;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      pathname = new URL(url).pathname;
    } else if (url.startsWith("/")) {
      pathname = url;
    } else {
      pathname = "/" + url;
    }

    let parts = pathname.slice(1).split("/").filter(Boolean);

    if (parts.length > 0 && allowedRoutes.includes(parts[0] as VoucherRoute)) {
      parts = parts.slice(1);
    }

    if (parts.length < 3) return null;

    const [issuer, topic, voucher] = parts;
    if (!issuer.startsWith("0x") || issuer.length !== 42) return null;

    return {
      issuer,
      topic: decodeURIComponent(topic),
      voucher: decodeURIComponent(voucher),
    };
  } catch {
    return null;
  }
}
