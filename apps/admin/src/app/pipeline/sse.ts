import type { PipelineSSEEvent } from "../api/pipeline/response.types";

/**
 * /api/pipeline은 text/event-stream으로 응답한다. EventSource는 POST 바디를 못 보내서
 * 못 쓰고, 대신 fetch()의 body를 직접 스트림으로 읽어서 "data: <JSON>\n\n" 단위로
 * 잘라 파싱한다.
 */
export async function* readPipelineSSEStream(response: Response): AsyncGenerator<PipelineSSEEvent> {
  if (!response.body) {
    throw new Error("응답 스트림을 읽을 수 없습니다.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      try {
        yield JSON.parse(dataLine.slice("data: ".length)) as PipelineSSEEvent;
      } catch {
        // 청크가 잘려서 왔거나 형식이 깨졌으면 조용히 건너뛴다 — 다음 청크에서 이어진다.
      }
    }
  }
}
