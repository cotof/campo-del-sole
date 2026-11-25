const numero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 4 });

export function unitaPerMetro(posizioni, divisore, altezzaMetri) {
  let minimo = Infinity;
  let massimo = -Infinity;
  for (let i = 2; i < posizioni.length; i += 3) {
    minimo = Math.min(minimo, posizioni[i]);
    massimo = Math.max(massimo, posizioni[i]);
  }
  return (massimo - minimo) / divisore / altezzaMetri;
}

export function intervalloScala(pixelPerMetro, larghezzaFinestra) {
  const limite = Math.min(190, larghezzaFinestra * 0.30);
  const massimoMetri = limite / pixelPerMetro;
  const decina = 10 ** Math.floor(Math.log10(massimoMetri));
  const rapporto = massimoMetri / decina;
  const passo = rapporto >= 5 ? 5 : rapporto >= 2 ? 2 : 1;
  const metri = passo * decina;
  return { metri, pixel: metri * pixelPerMetro };
}

export function creaScala(elemento, valore) {
  const stimata = elemento.dataset.stimata === 'true';
  const cifra = document.createElement('span');
  const unita = document.createElement('span');
  unita.className = 'unita-scala';
  unita.textContent = ' m';
  valore.replaceChildren(cifra, unita);

  let ultimaLarghezza;
  let ultimiMetri;
  return function aggiorna(pixelPerMetro, larghezzaFinestra) {
    const { metri, pixel } = intervalloScala(pixelPerMetro, larghezzaFinestra);
    if (pixel !== ultimaLarghezza) {
      elemento.style.width = `${pixel}px`;
      ultimaLarghezza = pixel;
    }
    if (metri !== ultimiMetri) {
      const misura = numero.format(metri);
      cifra.textContent = misura;
      elemento.setAttribute('aria-label', `${stimata ? 'Scala indicativa' : 'Scala grafica'} da 0 a ${misura} m`);
      ultimiMetri = metri;
    }
    elemento.hidden = false;
  };
}
