import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

// We accept the upload server-side (multipart) and then forward to Storage.
// This lets us authorize properly: only the owning store_owner can write
// images for their own store, and we control the path naming.
//
// Why not signed-URL direct upload: Supabase's signed-upload URLs require
// us to pre-create the storage object metadata, and the auth model is
// trickier. For MVP this server-relayed approach is simpler and adequate
// for the volumes we'll see.

interface UploadResult {
  variant: string;
  publicUrl: string;
  path: string;
}

const PRODUCT_BUCKET = 'product-images';
const STORE_BUCKET = 'store-assets';

export async function POST(request: Request) {
  const session = await readStaffSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const kind = String(form.get('kind') ?? ''); // 'product' | 'store-logo' | 'store-cover' | 'price'
  const productId = form.get('productId') ? String(form.get('productId')) : null;
  const itemKey = form.get('itemKey') ? String(form.get('itemKey')) : null;

  if (!['product', 'store-logo', 'store-cover', 'price', 'payment-qr'].includes(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

  // Authorize per kind: store assets/products require the owning store_owner;
  // price-index photos require admin/operator; payment QR is admin-only.
  if (kind === 'price') {
    if (session.role !== 'admin' && session.role !== 'operator') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!itemKey) {
      return NextResponse.json({ error: 'missing_item_key' }, { status: 400 });
    }
  } else if (kind === 'payment-qr') {
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  } else if (session.role !== 'store_owner' || !session.storeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (kind === 'product' && !productId) {
    return NextResponse.json({ error: 'missing_product_id' }, { status: 400 });
  }

  // Validate product ownership if uploading product images
  const supabase = getSupabaseAdmin();
  if (kind === 'product') {
    const { data: product } = await supabase
      .from('products')
      .select('id, store_id')
      .eq('id', productId)
      .maybeSingle();
    if (!product) {
      return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
    }
    if (product.store_id !== session.storeId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  // Read all variant blobs from the form
  // Form fields: variant_full (Blob), variant_thumb (Blob), etc.
  const variantEntries: Array<{ variant: string; blob: Blob }> = [];
  for (const [key, value] of form.entries()) {
    if (key.startsWith('variant_') && value instanceof Blob) {
      variantEntries.push({ variant: key.slice('variant_'.length), blob: value });
    }
  }
  if (variantEntries.length === 0) {
    return NextResponse.json({ error: 'no_variants' }, { status: 400 });
  }

  const timestamp = Date.now();
  const results: UploadResult[] = [];

  for (const entry of variantEntries) {
    if (entry.blob.size === 0) continue;
    if (entry.blob.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'variant_too_large', variant: entry.variant }, { status: 413 });
    }

    let bucket: string;
    let path: string;

    if (kind === 'price') {
      bucket = PRODUCT_BUCKET;
      const safeKey = itemKey!.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60);
      path = `price-index/${safeKey}/${timestamp}-${entry.variant}.webp`;
    } else if (kind === 'payment-qr') {
      bucket = STORE_BUCKET;
      path = `payment/qr-${timestamp}-${entry.variant}.webp`;
    } else if (kind === 'product') {
      bucket = PRODUCT_BUCKET;
      path = `products/${session.storeId}/${productId}/${timestamp}-${entry.variant}.webp`;
    } else if (kind === 'store-logo') {
      bucket = STORE_BUCKET;
      path = `stores/${session.storeId}/logo-${timestamp}.webp`;
    } else {
      bucket = STORE_BUCKET;
      path = `stores/${session.storeId}/cover-${timestamp}-${entry.variant}.webp`;
    }

    const arrayBuffer = await entry.blob.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000', // 1 year — file name has a timestamp so this is safe
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: 'storage_upload_failed', detail: uploadErr.message },
        { status: 500 },
      );
    }

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    results.push({ variant: entry.variant, publicUrl: pub.publicUrl, path });
  }

  return NextResponse.json({ ok: true, uploads: results });
}
