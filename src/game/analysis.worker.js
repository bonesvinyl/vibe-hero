import { analyze } from "./analysis";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      result: analyze(data.samples, data.sampleRate, data.difficulty),
    });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
