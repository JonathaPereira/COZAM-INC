/**
 * Configuração central da identidade visual do COZAM.
 * Conforme seção 2 do documento de requisitos:
 * "Permitir substituição da logo sem precisar reconstruir a interface."
 *
 * Todas as telas e componentes consomem exclusivamente as referências deste arquivo.
 */
export const BRAND = {
  acronym: 'COZAM',
  name: 'Consórcio Intermunicipal da Zona da Mata Alagoana e Serviços Públicos',
  systemName: 'Sistema Integrado de Compras e Pagamentos',
  shortSystemName: 'Compras e Pagamentos',

  // Caminhos das variantes da logo oficial
  logos: {
    // Logo vertical completa colorida (ideal para tela de login ou cartões sobre fundo claro)
    vertical: '/brand/logo-vertical.png',
    // Logo horizontal branca (ideal para cabeçalhos escuros, fundos verdes e barra lateral)
    horizontalWhite: '/brand/logo-horizontal-white.png',
    // Logo horizontal grafite (ideal para documentos impressos ou relatórios)
    horizontalDark: '/brand/logo-horizontal-dark.png',
    // Ícone da logo (folhas triangulares verdes)
    icon: '/brand/logo-icon.png',
    // Ícone branco vazado
    iconWhite: '/brand/logo-icon-white.png',
  },

  // Paleta de cores oficial extraída diretamente da marca
  colors: {
    vividGreen: '#6BE000',
    deepGreen: '#258900',
    darkGreen: '#1B6300',
    slateDark: '#2B3033',
    // Cor primária para botões e links acessíveis sobre fundo branco (contraste WCAG AA)
    primary: '#237A05',
    primaryHover: '#1B6300',
    primarySubtle: '#F0FDF4',
    primaryBorder: '#BBF7D0',
  },
} as const;
