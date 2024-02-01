function initCanvas(svgURL, width, height) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const image = new window.Image();
    canvas.width = width;
    canvas.height = height;
    image.onload = () => {
      context.drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.src = svgURL;
  });
}

export class SVGConverter {
  #svgText;
  #width;
  #height;

  static loadFromElement(original, width = null, height = null) {
    const bbox = original.getBoundingClientRect();
    if (width == null) {
      width = bbox.width;
    }
    if (height == null) {
      height = bbox.height;
    }
    const svg = original.cloneNode(true);
    svg.setAttributeNS(null, "version", "1.1");
    svg.setAttributeNS(null, "width", width);
    svg.setAttributeNS(null, "height", height);
    svg.setAttributeNS(
      "http://www.w3.org/2000/xmlns/",
      "xmlns",
      "http://www.w3.org/2000/svg",
    );
    svg.setAttributeNS(
      "http://www.w3.org/2000/xmlns/",
      "xmlns:xlink",
      "http://www.w3.org/1999/xlink",
    );
    return new SVGConverter(svg.outerHTML, width, height);
  }

  constructor(svgText, width, height) {
    this.#svgText = svgText;
    this.#width = width;
    this.#height = height;
  }

  svgURL() {
    const blob = new Blob([this.#svgText], {
      type: "image/svg+xml",
    });
    return URL.createObjectURL(blob);
  }

  pngURL() {
    return new Promise((resolve) => {
      const url = this.svgURL();
      initCanvas(url, this.#width, this.#height).then((canvas) => {
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          resolve(url);
        }, "image/png");
      });
    });
  }

  jpegURL() {
    return new Promise((resolve) => {
      const url = this.svgURL();
      initCanvas(url, this.#width, this.#height).then((canvas) => {
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          resolve(url);
        }, "image/jpeg");
      });
    });
  }
}
