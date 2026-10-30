const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

export function broadcastAlert(alert: Record<string, unknown>) {
  const data = `data: ${JSON.stringify(alert)}\n\n`;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  for (const controller of clients) {
    try {
      controller.enqueue(bytes);
    } catch {
      clients.delete(controller);
    }
  }
}

export function addSSEClient(controller: ReadableStreamDefaultController<Uint8Array>) {
  clients.add(controller);
  controller.enqueue(new TextEncoder().encode('data: {"type":"connected","message":"SSE stream ready"}\n\n'));
  return () => {
    clients.delete(controller);
  };
}

export function getSSEClientCount() {
  return clients.size;
}
