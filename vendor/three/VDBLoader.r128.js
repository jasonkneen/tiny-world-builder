( function () {

	// Minimal OpenVDB (.vdb) reader for TinyWorld.
	//
	// Scope: reads the SPARSE TOPOLOGY of the first float grid (e.g. EmberGen
	// "density") and returns the set of active voxel coordinates plus the grid's
	// index-space bounding box. That is all a voxelised cloud stamp needs — the
	// half-float value buffers (a second serialization pass) are intentionally
	// not decoded, so this stays small and dependency-free.
	//
	// Supports the common EmberGen export: file version >= 224, uncompressed
	// (COMPRESS_NONE), Tree_float_5_4_3 hierarchy (Internal<5> / Internal<4> /
	// Leaf<3>). Validated against each file's own `file_voxel_count` metadata.

	const OPENVDB_MAGIC = 0x56444220; // "VDB " little-endian
	const COMPRESS_ACTIVE_MASK = 2;

	class VDBLoader extends THREE.Loader {

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const loader = new THREE.FileLoader( scope.manager );
			loader.setPath( scope.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( scope.requestHeader );
			loader.load( url, function ( buffer ) {

				try {

					onLoad( scope.parse( buffer ) );

				} catch ( e ) {

					if ( onError ) onError( e ); else console.error( e );
					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}

		parse( buffer ) {

			const dv = new DataView( buffer );
			let p = 0;
			const u8 = () => dv.getUint8( p ++ );
			const u32 = () => { const v = dv.getUint32( p, true ); p += 4; return v; };
			const i32 = () => { const v = dv.getInt32( p, true ); p += 4; return v; };
			const i64 = () => { const lo = dv.getUint32( p, true ), hi = dv.getInt32( p + 4, true ); p += 8; return hi * 4294967296 + lo; };
			const f32 = () => { const v = dv.getFloat32( p, true ); p += 4; return v; };
			const f64 = () => { const v = dv.getFloat64( p, true ); p += 8; return v; };
			const str = () => { const n = u32(); let s = ''; for ( let i = 0; i < n; i ++ ) s += String.fromCharCode( u8() ); return s; };

			const magic = i64();
			if ( ( magic & 0xffffffff ) !== OPENVDB_MAGIC ) throw new Error( 'Not a valid VDB file' );
			const version = u32();
			if ( version < 222 ) throw new Error( 'Unsupported VDB version ' + version + ' (need >= 222)' );
			u32(); u32();                 // library major/minor
			u8();                          // hasGridOffsets
			for ( let i = 0; i < 36; i ++ ) u8(); // uuid
			u32();                         // file-level compression flags

			function skipMetaMap() {
				const count = u32();
				const meta = {};
				for ( let i = 0; i < count; i ++ ) {
					const name = str();
					const type = str();
					const nb = u32();
					const start = p;
					if ( type === 'int64' ) { const lo = dv.getUint32( p, true ), hi = dv.getInt32( p + 4, true ); meta[ name ] = hi * 4294967296 + lo; }
					else if ( type === 'int32' ) meta[ name ] = dv.getInt32( p, true );
					else if ( type === 'bool' ) meta[ name ] = dv.getUint8( p );
					else if ( type === 'vec3i' ) meta[ name ] = [ dv.getInt32( p, true ), dv.getInt32( p + 4, true ), dv.getInt32( p + 8, true ) ];
					else if ( type === 'string' ) { let s = ''; for ( let k = 0; k < nb; k ++ ) s += String.fromCharCode( dv.getUint8( p + k ) ); meta[ name ] = s; }
					p = start + nb;
				}
				return meta;
			}

			const gridCount = i32();
			if ( gridCount < 1 ) throw new Error( 'VDB has no grids' );

			// --- first grid only (the density field) ---
			const gridName = str();
			const gridType = str();
			str();                          // instance parent
			i64(); i64(); i64();            // stream positions (ignored)
			const gridComp = u32();
			const meta = skipMetaMap();
			const isHalf = !! meta.is_saved_as_half_float;
			const activeMask = ( gridComp & COMPRESS_ACTIVE_MASK ) !== 0;
			const bppValue = isHalf ? 2 : 4;

			// transform
			const mapType = str();
			let voxelSize = 1;
			if ( mapType === 'AffineMap' || mapType === 'ScaleMap' || mapType === 'UniformScaleMap' || mapType === 'ScaleTranslateMap' || mapType === 'UniformScaleTranslateMap' ) {
				// AffineMap (and the scale maps EmberGen may emit) serialize a Mat4d.
				const m = []; for ( let i = 0; i < 16; i ++ ) m.push( f64() );
				voxelSize = Math.cbrt( Math.abs( m[ 0 ] * m[ 5 ] * m[ 10 ] ) ) || Math.abs( m[ 0 ] ) || 1;
			} else {
				// Unknown map: bail rather than misread the tree.
				throw new Error( 'Unsupported VDB transform "' + mapType + '"' );
			}

			function readMask( bits ) {
				const bytes = bits >> 3;
				const arr = new Uint8Array( buffer, p, bytes );
				p += bytes;
				return arr;
			}
			const maskOn = ( arr, n ) => ( arr[ n >> 3 ] & ( 1 << ( n & 7 ) ) ) !== 0;
			function countOn( arr, bits ) { let on = 0; for ( let i = 0; i < bits; i ++ ) if ( maskOn( arr, i ) ) on ++; return on; }

			// Skip a topology value buffer (NUM_VALUES tile values), honouring the
			// node-mask-compression metadata byte (file version >= 222).
			function skipValues( count ) {
				const metadata = u8();
				let inactive = 0;
				if ( metadata === 2 || metadata === 4 ) inactive = 1;
				else if ( metadata === 5 ) inactive = 2;
				p += inactive * bppValue;
				let sel = null;
				if ( metadata === 3 || metadata === 4 || metadata === 5 ) sel = readMask( count );
				let toRead = count;
				if ( metadata !== 6 && metadata !== 0 && activeMask ) toRead = sel ? countOn( sel, count ) : 0;
				p += toRead * bppValue;
			}

			const coords = [];               // flat [x,y,z, x,y,z, ...]
			let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = - Infinity, maxY = - Infinity, maxZ = - Infinity;

			function readLeaf( ox, oy, oz ) {
				const vm = readMask( 512 );    // Leaf<3> value mask (8^3 bits)
				for ( let n = 0; n < 512; n ++ ) {
					if ( maskOn( vm, n ) ) {
						const x = ox + ( n >> 6 ), y = oy + ( ( n >> 3 ) & 7 ), z = oz + ( n & 7 );
						coords.push( x, y, z );
						if ( x < minX ) minX = x; if ( y < minY ) minY = y; if ( z < minZ ) minZ = z;
						if ( x > maxX ) maxX = x; if ( y > maxY ) maxY = y; if ( z > maxZ ) maxZ = z;
					}
				}
			}

			function readInternal( log2, ox, oy, oz ) {
				const bits = 1 << ( 3 * log2 );
				const child = readMask( bits );
				readMask( bits );              // value mask (unused for occupancy)
				skipValues( bits );            // internal tile values (half)
				const childSpanLog2 = log2 === 5 ? 7 : 3; // child node side = 2^7 (Internal<4>) or 2^3 (Leaf)
				const mask = ( 1 << log2 ) - 1;
				for ( let i = 0; i < bits; i ++ ) {
					if ( maskOn( child, i ) ) {
						const lx = i >> ( 2 * log2 ), ly = ( i >> log2 ) & mask, lz = i & mask;
						const cx = ox + ( lx << childSpanLog2 ), cy = oy + ( ly << childSpanLog2 ), cz = oz + ( lz << childSpanLog2 );
						if ( log2 === 5 ) readInternal( 4, cx, cy, cz );
						else readLeaf( cx, cy, cz );
					}
				}
			}

			// Tree: leading buffer count, root background, root tiles + children.
			i32();                            // numBuffers
			f32();                            // background
			const numTiles = u32();
			const numChildren = u32();
			for ( let t = 0; t < numTiles; t ++ ) { i32(); i32(); i32(); p += bppValue; u8(); }
			for ( let c = 0; c < numChildren; c ++ ) { const ox = i32(), oy = i32(), oz = i32(); readInternal( 5, ox, oy, oz ); }

			const count = coords.length / 3;
			const bbox = count
				? { min: [ minX, minY, minZ ], max: [ maxX, maxY, maxZ ] }
				: { min: [ 0, 0, 0 ], max: [ 0, 0, 0 ] };

			return {
				name: gridName,
				gridType,
				voxelSize,
				count,
				expectedCount: meta.file_voxel_count != null ? meta.file_voxel_count : count,
				coords: new Int32Array( coords ),
				bbox,
			};

		}

	}

	THREE.VDBLoader = VDBLoader;

}() );
