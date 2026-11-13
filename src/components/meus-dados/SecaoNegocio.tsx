'use client';

// dados-do-negocio: seção "Seu negócio" em /meus-dados (RF-DNG-25 a 29, TASK-FE-203).
import { useState, useId } from 'react';
import { formatCpfCnpj } from '@/lib/cpfCnpj';
import { buscarCep } from '@/lib/viaCep';
import { NegocioService } from '@/services/meusDados';
import type { DadosDoNegocio, ErroDoNegocio } from '@/types/meusDados';

export interface SecaoNegocioProps {
  dadosIniciais: DadosDoNegocio;
  tenantId: string;
  onSalvo?: (dados: DadosDoNegocio) => void;
}

export default function SecaoNegocio({
  dadosIniciais,
  tenantId,
  onSalvo,
}: SecaoNegocioProps) {
  const [dados, setDados] = useState<DadosDoNegocio>(dadosIniciais);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // Campos editáveis
  const [nomeNegocio, setNomeNegocio] = useState(dadosIniciais.nome_negocio ?? '');
  const [celular, setCelular] = useState(dadosIniciais.celular ?? '');
  const [cep, setCep] = useState(dadosIniciais.endereco?.cep ?? '');
  const [logradouro, setLogradouro] = useState(dadosIniciais.endereco?.logradouro ?? '');
  const [numero, setNumero] = useState(dadosIniciais.endereco?.numero ?? '');
  const [complemento, setComplemento] = useState(dadosIniciais.endereco?.complemento ?? '');
  const [bairro, setBairro] = useState(dadosIniciais.endereco?.bairro ?? '');
  const [cidade, setCidade] = useState(dadosIniciais.endereco?.cidade ?? '');
  const [uf, setUf] = useState(dadosIniciais.endereco?.uf ?? '');

  // Erros de retorno
  const [erroCampo, setErroCampo] = useState<{ campo?: string; detalhe?: string } | null>(null);
  const [erroAsaas, setErroAsaas] = useState<string | null>(null);
  const [erroIndisponivel, setErroIndisponivel] = useState(false);

  const idNomeNegocio = useId();
  const idCelular = useId();
  const idCep = useId();
  const idLogradouro = useId();
  const idNumero = useId();
  const idComplemento = useId();
  const idBairro = useId();
  const idCidade = useId();
  const idUf = useId();

  const podeEditar = dados.pode_editar;
  const enderecoPendente = dados.endereco_obrigatorio && !dados.endereco_completo;

  async function handleCepChange(novoCep: string) {
    setCep(novoCep);
    if (erroCampo?.campo === 'cep') setErroCampo(null);

    const digitos = novoCep.replace(/\D/g, '');
    if (digitos.length === 8) {
      const enderecoEncontrado = await buscarCep(digitos);
      if (enderecoEncontrado) {
        if (enderecoEncontrado.logradouro) setLogradouro(enderecoEncontrado.logradouro);
        if (enderecoEncontrado.bairro) setBairro(enderecoEncontrado.bairro);
        if (enderecoEncontrado.cidade) setCidade(enderecoEncontrado.cidade);
        if (enderecoEncontrado.uf) setUf(enderecoEncontrado.uf);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEditar || salvando) return;

    setSalvando(true);
    setSucesso(false);
    setErroCampo(null);
    setErroAsaas(null);
    setErroIndisponivel(false);

    try {
      const retorno = await NegocioService.salvar(tenantId, {
        nome_negocio: nomeNegocio,
        celular,
        endereco: {
          cep,
          logradouro,
          numero,
          complemento: complemento || undefined,
          bairro,
          cidade: cidade || undefined,
          uf: uf || undefined,
        },
      });

      setDados(retorno);
      setSucesso(true);
      if (onSalvo) onSalvo(retorno);
    } catch (err: unknown) {
      const erro = err as ErroDoNegocio;
      if (erro && typeof erro === 'object' && 'tipo' in erro) {
        if (erro.tipo === 'campo') {
          setErroCampo({ campo: erro.campo, detalhe: erro.detalhe });
        } else if (erro.tipo === 'asaas') {
          setErroAsaas(erro.detalhe ?? '');
        } else if (erro.tipo === 'indisponivel') {
          setErroIndisponivel(true);
        }
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Seu negócio</h2>

      {enderecoPendente && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium"
        >
          Falta o endereço. Sem ele, a nota fiscal das suas faturas não é emitida.
        </div>
      )}

      {sucesso && (
        <div
          role="status"
          className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium"
        >
          Dados salvos.
        </div>
      )}

      {erroAsaas !== null && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium"
        >
          {`O Asaas recusou: ${erroAsaas}. Confira o endereço.`}
        </div>
      )}

      {erroIndisponivel && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium"
        >
          Não foi possível salvar agora. Tente de novo em alguns minutos.
        </div>
      )}

      {!podeEditar && (
        <p className="mb-6 text-sm text-gray-500 italic">
          Só administradores do Portal mudam estes dados.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nome do negócio */}
          <div>
            <label
              htmlFor={podeEditar ? idNomeNegocio : undefined}
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Nome do negócio
            </label>
            {podeEditar ? (
              <div>
                <input
                  id={idNomeNegocio}
                  type="text"
                  value={nomeNegocio}
                  onChange={(e) => {
                    setNomeNegocio(e.target.value);
                    if (erroCampo?.campo === 'nome_negocio') setErroCampo(null);
                  }}
                  aria-invalid={erroCampo?.campo === 'nome_negocio' ? 'true' : undefined}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500"
                />
                {erroCampo?.campo === 'nome_negocio' && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{erroCampo.detalhe}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-900 py-2.5 font-medium">{dados.nome_negocio || '—'}</p>
            )}
          </div>

          {/* Celular */}
          <div>
            <label
              htmlFor={podeEditar ? idCelular : undefined}
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Celular
            </label>
            {podeEditar ? (
              <div>
                <input
                  id={idCelular}
                  type="text"
                  value={celular}
                  onChange={(e) => {
                    setCelular(e.target.value);
                    if (erroCampo?.campo === 'celular') setErroCampo(null);
                  }}
                  aria-invalid={erroCampo?.campo === 'celular' ? 'true' : undefined}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500"
                />
                {erroCampo?.campo === 'celular' && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{erroCampo.detalhe}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-900 py-2.5 font-medium">{dados.celular || '—'}</p>
            )}
          </div>

          {/* CPF / CNPJ (Somente Leitura) */}
          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-1">
              CPF/CNPJ
            </span>
            <p className="text-sm text-gray-900 font-medium py-1">
              {formatCpfCnpj(dados.documento) || '—'}
            </p>
            <p className="text-xs text-gray-500">Para trocar, fale com o suporte.</p>
          </div>

          {/* E-mail de cobrança (Somente Leitura) */}
          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-1">
              E-mail de cobrança
            </span>
            <p className="text-sm text-gray-900 font-medium py-1">
              {dados.email_cobranca || '—'}
            </p>
            <p className="text-xs text-gray-500">Para trocar, fale com o suporte.</p>
          </div>
        </div>

        {/* Endereço para a nota fiscal */}
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-base font-bold text-gray-900 mb-4">
            Endereço para a nota fiscal
          </h3>

          {podeEditar ? (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <label htmlFor={idCep} className="block text-sm font-semibold text-gray-700 mb-1">
                  CEP
                </label>
                <input
                  id={idCep}
                  type="text"
                  value={cep}
                  onChange={(e) => void handleCepChange(e.target.value)}
                  aria-invalid={erroCampo?.campo === 'cep' ? 'true' : undefined}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500"
                />
                {erroCampo?.campo === 'cep' && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{erroCampo.detalhe}</p>
                )}
              </div>

              <div className="md:col-span-4">
                <label htmlFor={idLogradouro} className="block text-sm font-semibold text-gray-700 mb-1">
                  Rua
                </label>
                <input
                  id={idLogradouro}
                  type="text"
                  value={logradouro}
                  onChange={(e) => {
                    setLogradouro(e.target.value);
                    if (erroCampo?.campo === 'logradouro') setErroCampo(null);
                  }}
                  aria-invalid={erroCampo?.campo === 'logradouro' ? 'true' : undefined}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500"
                />
                {erroCampo?.campo === 'logradouro' && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{erroCampo.detalhe}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label htmlFor={idNumero} className="block text-sm font-semibold text-gray-700 mb-1">
                  Número
                </label>
                <input
                  id={idNumero}
                  type="text"
                  value={numero}
                  onChange={(e) => {
                    setNumero(e.target.value);
                    if (erroCampo?.campo === 'numero') setErroCampo(null);
                  }}
                  aria-invalid={erroCampo?.campo === 'numero' ? 'true' : undefined}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500"
                />
                {erroCampo?.campo === 'numero' && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{erroCampo.detalhe}</p>
                )}
              </div>

              <div className="md:col-span-4">
                <label htmlFor={idComplemento} className="block text-sm font-semibold text-gray-700 mb-1">
                  Complemento
                </label>
                <input
                  id={idComplemento}
                  type="text"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor={idBairro} className="block text-sm font-semibold text-gray-700 mb-1">
                  Bairro
                </label>
                <input
                  id={idBairro}
                  type="text"
                  value={bairro}
                  onChange={(e) => {
                    setBairro(e.target.value);
                    if (erroCampo?.campo === 'bairro') setErroCampo(null);
                  }}
                  aria-invalid={erroCampo?.campo === 'bairro' ? 'true' : undefined}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500"
                />
                {erroCampo?.campo === 'bairro' && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{erroCampo.detalhe}</p>
                )}
              </div>

              <div className="md:col-span-3">
                <label htmlFor={idCidade} className="block text-sm font-semibold text-gray-700 mb-1">
                  Cidade
                </label>
                <input
                  id={idCidade}
                  type="text"
                  value={cidade}
                  onChange={(e) => {
                    setCidade(e.target.value);
                    if (erroCampo?.campo === 'cidade') setErroCampo(null);
                  }}
                  aria-invalid={erroCampo?.campo === 'cidade' ? 'true' : undefined}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500"
                />
                {erroCampo?.campo === 'cidade' && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{erroCampo.detalhe}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label htmlFor={idUf} className="block text-sm font-semibold text-gray-700 mb-1">
                  UF
                </label>
                <input
                  id={idUf}
                  type="text"
                  value={uf}
                  maxLength={2}
                  onChange={(e) => {
                    setUf(e.target.value);
                    if (erroCampo?.campo === 'uf') setErroCampo(null);
                  }}
                  aria-invalid={erroCampo?.campo === 'uf' ? 'true' : undefined}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500"
                />
                {erroCampo?.campo === 'uf' && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{erroCampo.detalhe}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-900 space-y-1">
              {dados.endereco ? (
                <>
                  <p>
                    {dados.endereco.logradouro}, {dados.endereco.numero}
                    {dados.endereco.complemento ? ` — ${dados.endereco.complemento}` : ''}
                  </p>
                  <p>
                    {dados.endereco.bairro} — {dados.endereco.cidade}/{dados.endereco.uf}
                  </p>
                  <p>CEP: {dados.endereco.cep}</p>
                </>
              ) : (
                <p className="text-gray-500 italic">Nenhum endereço cadastrado.</p>
              )}
            </div>
          )}
        </div>

        {podeEditar && (
          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={salvando}
              className="bg-brand-blue text-white rounded-xl font-bold py-2.5 px-5 text-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            >
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
