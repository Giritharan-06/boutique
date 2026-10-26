import { readProductImage } from '../../../../lib/local/product-images';
import { appRequest } from '../../../../lib/local/security';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) { if (!appRequest(req))
    return new Response('Request origin is not allowed.', { status: 403 }); const { id } = await params; const image = await readProductImage(id); if (!image)
    return new Response('Image not found.', { status: 404 }); return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }
