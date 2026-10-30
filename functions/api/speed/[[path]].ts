// Legacy callers preserve their POST body and task identity on the VPS.
export const onRequest = ({ request }) => {
  const url = new URL(request.url);
  url.protocol = 'https:'; url.host = 'speed.yukino.bond'; url.port = '';
  return new Response(null, { status: 307, headers: { Location: url.href, 'Cache-Control': 'no-store' } });
};
