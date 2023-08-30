import { GravityGameCanvas } from "./GravityGameCanvas";

export default function Home() {
    return (
        <main className="flex h-full w-full flex-col items-center justify-between p-24">
            <GravityGameCanvas />
        </main>
    );
}
