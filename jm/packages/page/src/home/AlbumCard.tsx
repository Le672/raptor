import type { BatchAlbumItem } from "../api";
import { CoverImage } from "./CoverImage";

export function AlbumCard({ item, cachedData, onClick, cardRef }: {
    item: { id: string; name: string; author: string };
    cachedData: BatchAlbumItem | undefined;
    onClick: () => void;
    cardRef?: (el: HTMLDivElement | null) => void;
}) {
    const photo = cachedData?.photo ?? null;

    return (
        <div
            ref={cardRef}
            data-album-id={item.id}
            className="jm-album-card"
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } }}
            aria-label={`查看作品：${item.name}`}
        >
            <div className="jm-album-cover">
                {photo?.images[0] ? (
                    <CoverImage
                        coverUrl={photo.images[0].url}
                        scrambleId={photo.scrambleId}
                        albumId={item.id}
                        className="w-full h-full"
                    />
                ) : (
                    <div className="w-full h-full animate-pulse" />
                )}
                <span className="jm-album-number">#{item.id}</span>
            </div>
            <div className="jm-album-info">
                <div className="jm-album-title" title={item.name}>
                    {item.name}
                </div>
                <div className="jm-album-author">{item.author || '作者未知'}</div>
            </div>
        </div>
    );
}
