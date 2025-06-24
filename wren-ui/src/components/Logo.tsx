interface Props {
  size?: number;
  color?: string;
}

export const Logo = (props: Props) => {
  const { color = 'var(--gray-9)', size = 30 } = props;
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 6 L15 24 L24 6" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
  );
};
